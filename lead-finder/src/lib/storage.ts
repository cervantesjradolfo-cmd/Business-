import { useCallback, useEffect, useState } from 'react'
import { getCategory } from '../data/categories'
import { DEFAULT_PROFILES } from '../data/profiles'
import { cleanKeywords } from './validate'
import type { AuditResult, CategoryId, ClientProfile, Lead, LeadStatus, Pitch, SavedLead, Sender } from './types'

export const STORAGE_KEYS = {
  saved: 'leadfinder:saved',
  sender: 'leadfinder:sender',
  accessKey: 'leadfinder:accessKey',
  profiles: 'leadfinder:profiles',
  activeProfile: 'leadfinder:activeProfile',
  outreach: 'leadfinder:outreach',
  mailbox: 'leadfinder:mailbox',
} as const

// Each client profile keeps its own saved leads; the agency profile keeps the original key.
export function savedKey(profileId?: string): string {
  return profileId ? `${STORAGE_KEYS.saved}:${profileId}` : STORAGE_KEYS.saved
}

// Outreach state and the mailbox are per profile too (same key scheme).
export function outreachKey(profileId?: string): string {
  return profileId ? `${STORAGE_KEYS.outreach}:${profileId}` : STORAGE_KEYS.outreach
}
export function mailboxKey(profileId?: string): string {
  return profileId ? `${STORAGE_KEYS.mailbox}:${profileId}` : STORAGE_KEYS.mailbox
}

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

export function loadSaved(key: string = STORAGE_KEYS.saved): Record<string, SavedLead> {
  const raw = readJson<unknown>(key, {})
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
      ...(typeof s.outreachEmail === 'string' ? { outreachEmail: s.outreachEmail } : {}),
      savedAt: typeof s.savedAt === 'string' ? s.savedAt : now,
      updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : now,
    }
  }
  return out
}

// The key is fixed for the hook's lifetime: the app remounts its workspace when the profile changes.
export function useSavedLeads(key: string = STORAGE_KEYS.saved) {
  const [saved, setSaved] = useState<Record<string, SavedLead>>(() => loadSaved(key))

  const update = useCallback((fn: (prev: Record<string, SavedLead>) => Record<string, SavedLead>) => {
    setSaved((prev) => {
      const next = fn(prev)
      writeJson(key, next)
      return next
    })
  }, [key])

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

  const setOutreachEmail = useCallback(
    (id: string, email: string) =>
      update((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], outreachEmail: email.trim(), updatedAt: new Date().toISOString() } } : prev)),
    [update],
  )

  return { saved, save, remove, setStatus, setNotes, setPitch, setOutreachEmail }
}

export const EMPTY_SENDER: Sender = { name: '', business: '', email: '', phone: '', address: '', website: '' }

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function toSender(raw: unknown): Sender {
  if (!raw || typeof raw !== 'object') return EMPTY_SENDER
  const r = raw as Partial<Sender>
  return { name: str(r.name), business: str(r.business), email: str(r.email), phone: str(r.phone), address: str(r.address), website: str(r.website) }
}

function loadSender(): Sender {
  return toSender(readJson<unknown>(STORAGE_KEYS.sender, null))
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

// ---- client profiles ----

export function loadProfiles(): ClientProfile[] {
  const raw = readJson<unknown>(STORAGE_KEYS.profiles, null)
  if (raw === null) return DEFAULT_PROFILES // first run
  if (!Array.isArray(raw)) return []
  const out: ClientProfile[] = []
  for (const v of raw) {
    const p = v as Partial<ClientProfile> | null
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || out.some((o) => o.id === p.id)) continue
    const categories = (Array.isArray(p.categories) ? p.categories : []).filter(
      (c): c is CategoryId => typeof c === 'string' && c !== 'any' && !!getCategory(c),
    )
    out.push({
      id: p.id,
      label: str(p.label).trim() || 'Client',
      offer: str(p.offer),
      sellingPoints: str(p.sellingPoints),
      categories,
      // Profiles saved before project search existed get the default keywords for their id, if any.
      projectKeywords: Array.isArray(p.projectKeywords)
        ? cleanKeywords(p.projectKeywords)
        : (DEFAULT_PROFILES.find((d) => d.id === p.id)?.projectKeywords ?? []),
      sender: toSender(p.sender),
    })
  }
  return out
}

export function newProfileId(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'client'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<ClientProfile[]>(loadProfiles)
  // '' = the agency profile
  const [activeId, setActiveId] = useState<string>(() => readJson<string>(STORAGE_KEYS.activeProfile, ''))

  const write = useCallback((fn: (prev: ClientProfile[]) => ClientProfile[]) => {
    setProfiles((prev) => {
      const next = fn(prev)
      writeJson(STORAGE_KEYS.profiles, next)
      return next
    })
  }, [])
  const select = useCallback((id: string) => {
    setActiveId(id)
    writeJson(STORAGE_KEYS.activeProfile, id)
  }, [])
  const saveProfile = useCallback(
    (p: ClientProfile) => write((prev) => (prev.some((o) => o.id === p.id) ? prev.map((o) => (o.id === p.id ? p : o)) : [...prev, p])),
    [write],
  )
  const deleteProfile = useCallback(
    (id: string) => {
      write((prev) => prev.filter((o) => o.id !== id))
      try {
        window.localStorage.removeItem(savedKey(id))
        window.localStorage.removeItem(outreachKey(id))
        window.localStorage.removeItem(mailboxKey(id))
      } catch {
        // storage disabled
      }
      setActiveId((cur) => {
        if (cur !== id) return cur
        writeJson(STORAGE_KEYS.activeProfile, '')
        return ''
      })
    },
    [write],
  )
  // A stored id whose profile was deleted (e.g. in another tab) falls back to the agency profile.
  const active = profiles.find((p) => p.id === activeId)
  return { profiles, active, select, saveProfile, deleteProfile }
}
