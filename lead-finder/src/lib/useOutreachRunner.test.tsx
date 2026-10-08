import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { enroll, loadOutreach } from './outreach'
import { emailFooter } from './pitch'
import { useOutreach } from './outreachStore'
import { useOutreachRunner } from './useOutreachRunner'
import type { Mailbox, Pitch, SavedLead, Sender } from './types'

const SENDER: Sender = { name: 'Sam', business: 'Acme Web', email: '', phone: '', address: '1 Main St', website: '' }
const MAILBOX: Mailbox = { host: 'smtp.gmail.com', port: 465, secure: true, user: 'u@gmail.com', pass: 'secret-pw', fromName: 'Sam', fromAddress: 'u@gmail.com', gapSeconds: 20, dailyCap: 30 }
const mk = (id: string): SavedLead => ({
  lead: { id, osmType: 'node', osmId: 1, osmUrl: '', name: `Biz ${id}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 1, email: `${id}@biz.example.com` },
  status: 'new', notes: '', savedAt: '', updatedAt: '',
})
const pitch: Pitch = { email: { subject: 'Quick idea', body: `Hi${emailFooter(SENDER)}` }, sms: '', phoneOpener: '', source: 'ai' }
const KEY = 'leadfinder:outreach'
const jsonRes = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })

function setup(saved: Record<string, SavedLead>, mailbox = MAILBOX) {
  const markContacted = vi.fn()
  const hook = renderHook(() => {
    const outreach = useOutreach(KEY)
    const runner = useOutreachRunner({ outreach, outreachKey: KEY, saved, mailbox, sender: SENDER, pitchFor: () => pitch, markContacted })
    return { outreach, runner }
  })
  return { ...hook, markContacted }
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('useOutreachRunner', () => {
  it('sends a due email through /api/send and records it', async () => {
    const saved = { a: mk('a') }
    window.localStorage.setItem(KEY, JSON.stringify(enroll(loadOutreach(KEY), saved.a, new Date(Date.now() - 1000))))
    const fetchMock = vi.fn(async () => jsonRes({ ok: true, messageId: '<m1@x>' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result, markContacted } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.outreach.state.enrollments.a.nextStep).toBe(1))
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ to: 'a@biz.example.com', subject: 'Quick idea', smtp: { host: 'smtp.gmail.com', port: 465 } })
    const state = loadOutreach(KEY)
    expect(state.enrollments.a.history[0]).toMatchObject({ step: 0, via: 'smtp', messageId: '<m1@x>' })
    expect(state.enrollments.a.pendingSend).toBeUndefined()
    expect(state.sentToday.count).toBe(1)
    expect(markContacted).toHaveBeenCalledTimes(1)
  })

  it('stops on an auth error and keeps the step due with the message', async () => {
    const saved = { a: mk('a'), b: mk('b') }
    let s = enroll(loadOutreach(KEY), saved.a, new Date(Date.now() - 2000))
    s = enroll(s, saved.b, new Date(Date.now() - 1000))
    window.localStorage.setItem(KEY, JSON.stringify(s))
    const fetchMock = vi.fn(async () => jsonRes({ ok: false, code: 'auth', error: 'Bad password.' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.message).toBe('Bad password.'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(loadOutreach(KEY).enrollments.a).toMatchObject({ nextStep: 0, lastError: 'Bad password.' })
    expect(loadOutreach(KEY).enrollments.a.pendingSend).toBeUndefined()
  })

  it('does nothing without a mailbox', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup({ a: mk('a') }, { ...MAILBOX, pass: '' })
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.message).toBe('Set up your mailbox first'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops at the daily limit', async () => {
    const saved = { a: mk('a') }
    const s = enroll(loadOutreach(KEY), saved.a, new Date(Date.now() - 1000))
    const day = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    window.localStorage.setItem(KEY, JSON.stringify({ ...s, sentToday: { day: `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}`, count: 2 } }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved, { ...MAILBOX, dailyCap: 2 })
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.message).toContain('Daily limit reached (2)'))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
