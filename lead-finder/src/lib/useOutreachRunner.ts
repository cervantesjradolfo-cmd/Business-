// The send queue for Outreach. Lives in Workspace so a run survives switching tabs.
// Sends the due emails one by one through the user's mailbox, pausing between sends and stopping at the daily cap.
import { useCallback, useEffect, useRef, useState } from 'react'
import { sendEmail } from './api'
import {
  buildStepEmail, dueSteps, loadOutreach, mailboxReady, recordError, recordSent, sentTodayCount, setPending, suppress, syncWithSaved,
} from './outreach'
import { emailFooter } from './pitch'
import { writeJson } from './storage'
import type { ClientProfile, Mailbox, OutreachState, Pitch, SavedLead, SendRequest, SendResult, Sender } from './types'

export type RunStatus = { running: boolean; auto: boolean; sent: number; total: number; nextAt?: number; message?: string }

const AUTO_EVERY_MS = 60_000
const RETRY_AFTER_ERROR_MS = 3_600_000

type Args = {
  outreach: { state: OutreachState; update: (fn: (p: OutreachState) => OutreachState) => void }
  outreachKey: string // storage key of the outreach state (re-read before every send, other tabs may have changed it)
  saved: Record<string, SavedLead>
  mailbox: Mailbox
  sender: Sender
  profile?: ClientProfile
  pitchFor: (s: SavedLead) => Pitch
  markContacted: (s: SavedLead) => void
}

const smtpOf = (m: Mailbox) => ({ host: m.host.trim(), port: m.port, secure: m.secure, user: m.user, pass: m.pass })

// Resolves after ms, or as soon as the signal aborts.
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(t)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const t = setTimeout(done, ms)
    signal.addEventListener('abort', done)
  })
}

export function useOutreachRunner(a: Args) {
  const latest = useRef(a)
  useEffect(() => {
    latest.current = a
  })
  const [status, setStatus] = useState<RunStatus>({ running: false, auto: false, sent: 0, total: 0 })
  const [auto, setAutoOn] = useState(false)
  const running = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const lastSentAt = useRef(0)

  // Reads the stored state (picks up other tabs), applies fn, writes it and pushes it into React state.
  const mutate = useCallback((fn: (s: OutreachState) => OutreachState): OutreachState => {
    const { outreach, outreachKey } = latest.current
    const stored = loadOutreach(outreachKey)
    const next = fn(stored)
    if (next !== stored || JSON.stringify(stored) !== JSON.stringify(outreach.state)) {
      writeJson(outreachKey, next)
      outreach.update(() => next)
    }
    return next
  }, [])

  const run = useCallback(async (autoRun: boolean) => {
    if (running.current) return
    if (!mailboxReady(latest.current.mailbox)) {
      setStatus((s) => ({ ...s, message: 'Set up your mailbox first' }))
      return
    }
    running.current = true
    const ctrl = new AbortController()
    abort.current = ctrl
    const failed = new Set<string>()
    let sent = 0
    let total = 0
    let message: string | undefined
    setStatus({ running: true, auto: autoRun, sent: 0, total: 0 })
    try {
      while (!ctrl.signal.aborted) {
        const { saved, mailbox, sender, pitchFor, markContacted } = latest.current
        const state = mutate((s) => syncWithSaved(s, saved))
        const now = new Date()
        const queue = dueSteps(state, saved, now, autoRun ? { skipRecentErrorsMs: RETRY_AFTER_ERROR_MS } : undefined).filter((e) => !failed.has(e.leadId))
        if (queue.length === 0) break
        total = sent + queue.length
        if (sentTodayCount(state, now) >= mailbox.dailyCap) {
          message = `Daily limit reached (${mailbox.dailyCap}). The rest stay due until tomorrow.`
          break
        }
        const waitMs = lastSentAt.current + mailbox.gapSeconds * 1000 - Date.now()
        if (waitMs > 0) {
          setStatus({ running: true, auto: autoRun, sent, total, nextAt: Date.now() + waitMs })
          await wait(waitMs, ctrl.signal)
          continue // the state may have changed while waiting
        }
        setStatus({ running: true, auto: autoRun, sent, total })

        const e = queue[0]
        const lead = saved[e.leadId]
        const built = buildStepEmail({ enrollment: e, saved: lead, pitch: pitchFor(lead), campaign: state.campaign, sender })
        if (!built.ok) {
          mutate((s) => recordError(s, e.leadId, built.error, new Date()))
          failed.add(e.leadId)
          continue
        }
        const step = e.nextStep
        mutate((s) => setPending(s, e.leadId, { step, startedAt: new Date().toISOString() }))
        // Never aborted mid-send: stop() only ends the waits.
        const res = await sendEmail({
          smtp: smtpOf(mailbox),
          from: { name: mailbox.fromName, address: mailbox.fromAddress },
          to: e.email,
          subject: built.subject,
          text: built.body,
          ...(built.inReplyTo ? { inReplyTo: built.inReplyTo } : {}),
          suppressed: state.suppressed,
        })
        lastSentAt.current = Date.now()
        if (res.ok) {
          const at = new Date()
          mutate((s) => recordSent(setPending(s, e.leadId, undefined), e.leadId, { step, sentAt: at.toISOString(), subject: built.subject, via: 'smtp', messageId: res.messageId }, at))
          if (lead.status === 'new') markContacted(lead)
          sent++
          continue
        }
        mutate((s) => {
          const cleared = recordError(setPending(s, e.leadId, undefined), e.leadId, res.error, new Date())
          return res.code === 'suppressed' ? suppress(cleared, e.email) : cleared
        })
        failed.add(e.leadId)
        if (res.code === 'auth' || res.code === 'access' || res.code === 'unavailable') {
          message = res.error
          break
        }
      }
    } finally {
      running.current = false
      abort.current = null
      setStatus({ running: false, auto: autoRun, sent, total, ...(message ? { message } : {}) })
    }
  }, [mutate])

  const runNow = useCallback(() => void run(false), [run])
  const stop = useCallback(() => abort.current?.abort(), [])
  const setAuto = useCallback((on: boolean) => {
    if (on && !mailboxReady(latest.current.mailbox)) {
      setStatus((s) => ({ ...s, message: 'Set up your mailbox first' }))
      return
    }
    setAutoOn(on)
  }, [])

  // Auto-send: look for due emails now and every minute while this tab is open.
  useEffect(() => {
    if (!auto) return
    void run(true)
    const id = setInterval(() => void run(true), AUTO_EVERY_MS)
    return () => clearInterval(id)
  }, [auto, run])

  // A profile switch remounts the workspace: end the waits so a run never continues with another profile.
  useEffect(() => () => abort.current?.abort(), [])

  useEffect(() => {
    if (!status.running) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [status.running])

  const sendTest = useCallback(async (): Promise<SendResult> => {
    const { mailbox, sender } = latest.current
    const req: SendRequest = {
      smtp: smtpOf(mailbox),
      from: { name: mailbox.fromName, address: mailbox.fromAddress },
      to: mailbox.fromAddress,
      subject: 'Lead Finder test email',
      text: `This is a test from Lead Finder. Your mailbox settings work.${emailFooter(sender)}`,
      suppressed: [],
    }
    return sendEmail(req)
  }, [])

  return { status: { ...status, auto }, runNow, stop, setAuto, sendTest }
}
