import { useCallback, useEffect, useState } from 'react'
import type { AuditResult, Lead, LeadStatus, Pitch, SavedLead, Sender } from './types'

export const STORAGE_KEYS = { saved: 'leadfinder:saved', sender: 'leadfinder:sender', accessKey: 'leadfinder:accessKey' } as const

// Optional access key for deployments that set APP_ACCESS_KEY. Sent as the x-access-key header.
export function getAccessKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.accessKey) ?? ''
  } catch {
    return ''
  }
}

export function setAccessKey(key: string): void {
  try {
    if (key.trim()) window.localStorage.setItem(STORAGE_KEYS.accessKey, key.trim())
    else window.localStorage.removeItem(STORAGE_KEYS.accessKey)
  } catch {
    // disabled or over quota
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // disabled or over quota: keep working in memory
  }
}

const STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'won', 'lost']

export function loadSaved(): Record<string, SavedLead> {
  const raw = readJson<unknown>(STORAGE_KEYS.saved, {})
  const out: Record<string, SavedLead> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = v as Partial<SavedLead> | null
    if (!s || typeof s !== 'object' || !s.lead || typeof s.lead.id !== 'string' || typeof s.lead.name !== 'string') continue
    const now = new Date().toISOString()
    out[id] = {
      lead: s.lead,
      audit: s.audit,
      status: STATUSES.includes(s.status as LeadStatus) ? (s.status as LeadStatus) : 'new',
      notes: typeof s.notes === 'string' ? s.notes : '',
      pitch: s.pitch,
      savedAt: typeof s.savedAt === 'string' ? s.savedAt : now,
      updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : now,
    }
  }
  return out
}

export function useSavedLeads() {
  const [saved, setSaved] = useState<Record<string, SavedLead>>(loadSaved)

  const update = useCallback((fn: (prev: Record<string, SavedLead>) => Record<string, SavedLead>) => {
    setSaved((prev) => {
      const next = fn(prev)
      writeJson(STORAGE_KEYS.saved, next)
      return next
    })
  }, [])

  const upsert = useCallback(
    (lead: Lead, audit: AuditResult | undefined, patch: Partial<SavedLead>) =>
      update((prev) => {
        const now = new Date().toISOString()
        const old = prev[lead.id]
        return {
          ...prev,
          [lead.id]: {
            ...old,
            ...patch,
            status: patch.status ?? old?.status ?? 'new',
            notes: patch.notes ?? old?.notes ?? '',
            savedAt: old?.savedAt ?? now,
            lead,
            audit: audit ?? old?.audit,
            updatedAt: now,
          },
        }
      }),
    [update],
  )

  const save = useCallback((lead: Lead, audit?: AuditResult) => upsert(lead, audit, {}), [upsert])
  const remove = useCallback(
    (id: string) =>
      update((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      }),
    [update],
  )
  const setStatus = useCallback(
    (lead: Lead, audit: AuditResult | undefined, status: LeadStatus) => upsert(lead, audit, { status }),
    [upsert],
  )
  const setNotes = useCallback(
    (lead: Lead, audit: AuditResult | undefined, notes: string) => upsert(lead, audit, { notes }),
    [upsert],
  )
  const setPitch = useCallback(
    (id: string, pitch: Pitch) =>
      update((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], pitch, updatedAt: new Date().toISOString() } } : prev)),
    [update],
  )

  return { saved, save, remove, setStatus, setNotes, setPitch }
}

const EMPTY_SENDER: Sender = { name: '', business: '', email: '', phone: '', address: '', website: '' }

function loadSender(): Sender {
  const raw = readJson<Partial<Sender> | null>(STORAGE_KEYS.sender, null)
  if (!raw || typeof raw !== 'object') return EMPTY_SENDER
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  return { name: s(raw.name), business: s(raw.business), email: s(raw.email), phone: s(raw.phone), address: s(raw.address), website: s(raw.website) }
}

export function useSender(): [Sender, (s: Sender) => void] {
  const [sender, setSender] = useState<Sender>(loadSender)
  useEffect(() => {
    // keep in sync if another tab edits it
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.sender) setSender(loadSender())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const set = useCallback((s: Sender) => {
    setSender(s)
    writeJson(STORAGE_KEYS.sender, s)
  }, [])
  return [sender, set]
}
