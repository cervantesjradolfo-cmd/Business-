// Reply checks for Outreach: reads the mailbox for answers to outreach emails, marks those leads Replied
// (which stops their follow-ups), has AI sort each reply and draft an answer, and sends the answer you approve.
import { useCallback, useEffect, useRef, useState } from 'react'
import { checkInbox, fetchReplyDraft, sendEmail } from './api'
import { buildStepEmail, loadOutreach, mailboxReady, stripFooter } from './outreach'
import { applyReplyDraft, inboxReady, inboxRequestFor, mergeReplies, replyEmail, updateReply } from './replies'
import { scoreLead } from './scoring'
import { writeJson } from './storage'
import type { ClientProfile, Mailbox, OutreachState, Pitch, ReplyRequest, SavedLead, Sender } from './types'

export type ReplyCheck = { checking: boolean; drafting: number; message?: string; error?: string }

const AUTO_EVERY_MS = 5 * 60_000

type Args = {
  outreach: { state: OutreachState; update: (fn: (p: OutreachState) => OutreachState) => void }
  outreachKey: string
  saved: Record<string, SavedLead>
  mailbox: Mailbox
  sender: Sender
  profile?: ClientProfile
  pitchFor: (s: SavedLead) => Pitch
  markReplied: (s: SavedLead) => void
  auto: boolean // check every few minutes (on while auto-send is on)
}

const smtpOf = (m: Mailbox) => ({ host: m.host.trim(), port: m.port, secure: m.secure, user: m.user, pass: m.pass })

export function useReplies(a: Args) {
  const latest = useRef(a)
  useEffect(() => {
    latest.current = a
  })
  const [check, setCheck] = useState<ReplyCheck>({ checking: false, drafting: 0 })
  const busy = useRef(false)
  const drafting = useRef(new Set<string>())

  // Same as the send runner: re-read the stored state (another tab may have changed it), apply fn, write it.
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

  const requestFor = useCallback((replyId: string, state: OutreachState): ReplyRequest | null => {
    const { saved, sender, profile, pitchFor } = latest.current
    const r = state.replies[replyId]
    const s = r && saved[r.leadId]
    if (!r || !s || !r.text.trim()) return null
    const e = state.enrollments[r.leadId]
    const last = e?.history[e.history.length - 1]
    const pitch = pitchFor(s)
    const built = e && last ? buildStepEmail({ enrollment: { ...e, nextStep: last.step }, saved: s, pitch, campaign: state.campaign, sender }) : undefined
    const lead = scoreLead(s.lead, s.audit)
    return {
      lead: { name: s.lead.name, category: s.lead.category, city: s.lead.city ?? s.lead.project?.city },
      sender: { name: sender.name, business: sender.business },
      services: lead.services,
      ...(profile ? { offer: { services: profile.offer, sellingPoints: profile.sellingPoints } } : {}),
      ourEmail: built?.ok
        ? { subject: last?.subject ?? built.subject, body: stripFooter(built.body, sender) }
        : { subject: pitch.email.subject, body: stripFooter(pitch.email.body, sender) },
      theirReply: r.text,
    }
  }, [])

  // Asks the AI to sort one reply and draft the answer. force = you asked for it, so it replaces your edits.
  // false = AI isn't set up (nothing changed).
  const draft = useCallback(async (replyId: string, force = false): Promise<boolean> => {
    if (drafting.current.has(replyId)) return true
    const req = requestFor(replyId, loadOutreach(latest.current.outreachKey))
    if (!req) return false
    drafting.current.add(replyId)
    setCheck((c) => ({ ...c, drafting: drafting.current.size }))
    try {
      const d = await fetchReplyDraft(req)
      if (!d) return false
      mutate((s) => applyReplyDraft(s, replyId, d, new Date(), force))
      return true
    } finally {
      drafting.current.delete(replyId)
      setCheck((c) => ({ ...c, drafting: drafting.current.size }))
    }
  }, [mutate, requestFor])

  const run = useCallback(async (quiet: boolean) => {
    if (busy.current) return
    const { mailbox, outreachKey } = latest.current
    if (!inboxReady(mailbox)) {
      if (!quiet) setCheck((c) => ({ ...c, error: 'Add the incoming mail server (IMAP) under Mailbox first.', message: undefined }))
      return
    }
    const req = inboxRequestFor(loadOutreach(outreachKey), mailbox, new Date())
    if (!req) {
      if (!quiet) setCheck((c) => ({ ...c, message: 'No emails sent yet, so there is nothing to check.', error: undefined }))
      return
    }
    busy.current = true
    setCheck((c) => ({ ...c, checking: true, error: undefined, message: undefined }))
    try {
      const res = await checkInbox(req)
      if (!res.ok) {
        setCheck((c) => ({ ...c, checking: false, error: res.error }))
        return
      }
      const now = new Date()
      let merged: ReturnType<typeof mergeReplies> | undefined
      mutate((s) => {
        merged = mergeReplies(s, res.messages, now)
        return { ...merged.state, inboxCheckedAt: now.toISOString() }
      })
      const m = merged!
      const { saved, markReplied } = latest.current
      for (const id of m.replied) if (saved[id]) markReplied(saved[id])
      const real = m.added.length - m.autoReplies
      const parts = [real === 0 ? 'No new replies' : `${real} new ${real === 1 ? 'reply' : 'replies'}`]
      if (m.unsubscribed) parts.push(`${m.unsubscribed} unsubscribed`)
      if (m.autoReplies) parts.push(`${m.autoReplies} auto-${m.autoReplies === 1 ? 'reply' : 'replies'} skipped`)
      setCheck((c) => ({ ...c, checking: false, message: parts.join(', ') }))
      for (const r of m.added) {
        if (!r.handled) await draft(r.id)
      }
    } finally {
      busy.current = false
      setCheck((c) => (c.checking ? { ...c, checking: false } : c))
    }
  }, [draft, mutate])

  const checkNow = useCallback(() => void run(false), [run])

  // Sends the answer through the mailbox and marks the reply handled.
  const send = useCallback(async (replyId: string, body: string): Promise<{ ok: boolean; error?: string }> => {
    const { mailbox, sender } = latest.current
    if (!mailboxReady(mailbox)) return { ok: false, error: 'Set up your mailbox first.' }
    const state = loadOutreach(latest.current.outreachKey)
    const r = state.replies[replyId]
    if (!r) return { ok: false, error: 'That reply is gone.' }
    if (!body.trim()) return { ok: false, error: 'The answer needs some text.' }
    if (state.suppressed.includes(r.from)) return { ok: false, error: "This address unsubscribed, so it won't be emailed." }
    const email = replyEmail(r, body, sender)
    const res = await sendEmail({
      smtp: smtpOf(mailbox),
      from: { name: mailbox.fromName, address: mailbox.fromAddress },
      to: r.from,
      subject: email.subject,
      text: email.body,
      ...(email.inReplyTo ? { inReplyTo: email.inReplyTo } : {}),
      suppressed: state.suppressed,
    })
    if (!res.ok) return { ok: false, error: res.error }
    mutate((s) => updateReply(s, replyId, { draft: { body: body.trim(), source: s.replies[replyId]?.draft?.source ?? 'edited' }, handled: { at: new Date().toISOString(), how: 'sent' } }))
    return { ok: true }
  }, [mutate])

  // Auto-check every few minutes while auto-send is on.
  useEffect(() => {
    if (!a.auto) return
    const first = setTimeout(() => void run(true), 0)
    const id = setInterval(() => void run(true), AUTO_EVERY_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [a.auto, run])

  return { check, checkNow, draft, send }
}
