// Background mode for one profile: the server sends and checks replies on a schedule while the app is closed.
// While it's on, this hook keeps the browser's copy and the server's in step (every minute, and a few
// seconds after you change something), and applies the server's status changes to your saved leads.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccessKey } from './storage'
import { loadOutreach } from './outreach'
import { readJson, writeJson } from './localStore'
import { scoreLead } from './scoring'
import { mergeOutreach, statusChangesFor } from './sync'
import type { BackgroundLead, BackgroundStatus, ClientProfile, LeadStatus, Mailbox, OutreachState, Pitch, SavedLead, Sender, SyncResponse } from './types'

const BASE: string = import.meta.env.VITE_API_BASE ?? ''
const SYNC_EVERY_MS = 60_000
const DEBOUNCE_MS = 3_000

type Args = {
  workspace: string // 'agency' or the client profile id
  outreach: { state: OutreachState; update: (fn: (p: OutreachState) => OutreachState) => void }
  outreachKey: string
  saved: Record<string, SavedLead>
  mailbox: Mailbox
  sender: Sender
  profile?: ClientProfile
  pitchFor: (s: SavedLead) => Pitch
  applyStatus: (s: SavedLead, status: LeadStatus) => void
}

export type BackgroundView = BackgroundStatus & { busy: boolean; error?: string; syncedAt?: string; note?: string }

async function call(body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const key = getAccessKey()
  try {
    const res = await fetch(`${BASE}/api/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'x-access-key': key } : {}) },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server.' } }
  }
}

export function useBackground(a: Args) {
  const latest = useRef(a)
  useEffect(() => {
    latest.current = a
  })
  const [view, setView] = useState<BackgroundView>({ available: false, enabled: false, busy: false })
  const enabled = view.enabled
  const seenKey = `${a.outreachKey}:background-seen`

  // The server's copy merged into ours: your edits since the request was sent are kept.
  const absorb = useCallback((r: SyncResponse) => {
    const { outreach, outreachKey, saved, applyStatus } = latest.current
    if (r.outreach) {
      const local = loadOutreach(outreachKey)
      const next = mergeOutreach(r.outreach, local)
      // Only when something changed: an unchanged state must not trigger another sync.
      if (JSON.stringify(next) !== JSON.stringify(local)) {
        writeJson(outreachKey, next)
        outreach.update(() => next)
      }
    }
    const seen = readJson<string>(seenKey, '')
    for (const c of statusChangesFor(saved, r.events ?? [], seen)) {
      const s = saved[c.leadId]
      if (s) applyStatus(s, c.status)
    }
    const last = (r.events ?? []).reduce((m, e) => (e.at > m ? e.at : m), seen)
    if (last !== seen) writeJson(seenKey, last)
  }, [seenKey])

  const snapshot = useCallback(() => {
    const { workspace, outreachKey, saved, mailbox, sender, profile, pitchFor } = latest.current
    const state = loadOutreach(outreachKey)
    const leads: Record<string, BackgroundLead> = {}
    for (const id of Object.keys(state.enrollments)) {
      const s = saved[id]
      if (!s) continue
      leads[id] = {
        id, name: s.lead.name, category: s.lead.category, status: s.status, updatedAt: s.updatedAt,
        ...(s.lead.city ?? s.lead.project?.city ? { city: s.lead.city ?? s.lead.project?.city } : {}),
        pitch: pitchFor(s), services: scoreLead(s.lead, s.audit).services,
      }
    }
    return {
      workspace, outreach: state, leads, sender, mailbox,
      ...(profile ? { offer: { services: profile.offer, sellingPoints: profile.sellingPoints } } : {}),
    }
  }, [])

  const busy = useRef(false)
  const sync = useCallback(async (quiet = true): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    if (!quiet) setView((v) => ({ ...v, busy: true, error: undefined }))
    try {
      const r = await call({ action: 'sync', ...snapshot() })
      if (!r.ok) {
        // 409: a scheduled run is working on it; try again next time.
        if (r.status !== 409 || !quiet) setView((v) => ({ ...v, error: r.status === 409 ? 'The server is busy sending. Try again in a minute.' : String(r.data.error ?? 'Sync failed') }))
        return false
      }
      const res = r.data as unknown as SyncResponse
      absorb(res)
      setView((v) => ({ ...v, available: true, enabled: true, error: undefined, syncedAt: new Date().toISOString(), lastRunAt: res.lastRunAt, lastRunNote: res.lastRunNote }))
      return true
    } finally {
      busy.current = false
      if (!quiet) setView((v) => ({ ...v, busy: false }))
    }
  }, [absorb, snapshot])

  // On start (and on profile switch, which remounts): is it set up, and is it on for this profile?
  useEffect(() => {
    let live = true
    void call({ action: 'status', workspace: a.workspace }).then((r) => {
      if (!live || !r.ok) return
      const st = r.data as unknown as BackgroundStatus
      setView((v) => ({ ...v, available: !!st.available, enabled: !!st.enabled, lastRunAt: st.lastRunAt, lastRunNote: st.lastRunNote }))
    })
    return () => { live = false }
  }, [a.workspace])

  // While on: sync every minute, and a few seconds after anything changes.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => void sync(), SYNC_EVERY_MS)
    return () => clearInterval(id)
  }, [enabled, sync])
  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => void sync(), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [enabled, sync, a.outreach.state, a.saved, a.mailbox, a.sender])

  const turnOn = useCallback(() => sync(false), [sync])

  const turnOff = useCallback(async () => {
    setView((v) => ({ ...v, busy: true, error: undefined }))
    const r = await call({ action: 'disable', workspace: latest.current.workspace })
    if (r.ok) {
      absorb(r.data as unknown as SyncResponse)
      setView((v) => ({ ...v, enabled: false, busy: false }))
    } else setView((v) => ({ ...v, busy: false, error: String(r.data.error ?? 'Turning it off failed') }))
  }, [absorb])

  // Run now: sync first so the server has your latest changes, then check replies and send what's due.
  const runNow = useCallback(async () => {
    setView((v) => ({ ...v, busy: true, error: undefined, note: undefined }))
    await sync()
    const r = await call({ action: 'run', workspace: latest.current.workspace })
    if (!r.ok) {
      setView((v) => ({ ...v, busy: false, error: r.status === 409 ? 'A scheduled run is working right now. Try again in a minute.' : String(r.data.error ?? 'Run failed') }))
      return
    }
    await sync()
    setView((v) => ({ ...v, busy: false, note: String(r.data.note ?? '') }))
  }, [sync])

  return { view, turnOn, turnOff, runNow }
}
