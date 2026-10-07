import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { enroll, loadOutreach, localDay, recordSent, setPending } from './outreach'
import { emailFooter } from './pitch'
import { useOutreach } from './outreachStore'
import { useOutreachRunner } from './useOutreachRunner'
import type { Mailbox, OutreachState, Pitch, SavedLead, Sender } from './types'

const SENDER: Sender = { name: 'Sam', business: 'Acme Web', email: '', phone: '', address: '1 Main St', website: '' }
const MAILBOX: Mailbox = { host: 'smtp.gmail.com', port: 465, secure: true, user: 'u@gmail.com', pass: 'secret-pw', fromName: 'Sam', fromAddress: 'u@gmail.com', gapSeconds: 20, dailyCap: 30 }
const mk = (id: string, status: SavedLead['status'] = 'new'): SavedLead => ({
  lead: { id, osmType: 'node', osmId: 1, osmUrl: '', name: `Biz ${id}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 1, email: `${id}@biz.example.com` },
  status, notes: '', savedAt: '', updatedAt: '',
})
const pitch: Pitch = { email: { subject: 'Quick idea', body: `Hi${emailFooter(SENDER)}` }, sms: '', phoneOpener: '', source: 'ai' }
const stale: Pitch = { email: { subject: 'Old', body: 'Hi [Your name]' }, sms: '', phoneOpener: '', source: 'ai' }
const KEY = 'leadfinder:outreach'
const jsonRes = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
const past = (ms: number) => new Date(Date.now() - ms)

function seed(fn: (s: OutreachState) => OutreachState) {
  window.localStorage.setItem(KEY, JSON.stringify(fn(loadOutreach(KEY))))
}
function setup(saved: Record<string, SavedLead>, mailbox = MAILBOX, p: Pitch = pitch) {
  const markContacted = vi.fn()
  const hook = renderHook(() => {
    const outreach = useOutreach(KEY)
    const runner = useOutreachRunner({ outreach, outreachKey: KEY, saved, mailbox, sender: SENDER, pitchFor: () => p, markContacted })
    return { outreach, runner }
  })
  return { ...hook, markContacted }
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('runner safety', () => {
  it('stops mid-run when the daily cap is reached, leaving the rest due', async () => {
    const saved = { a: mk('a'), b: mk('b'), c: mk('c') }
    seed((s) => {
      let n = s
      n = enroll(n, saved.a, past(3000)); n = enroll(n, saved.b, past(2000)); n = enroll(n, saved.c, past(1000))
      return { ...n, sentToday: { day: localDay(new Date()), count: 1 } }
    })
    const fetchMock = vi.fn(async () => jsonRes({ ok: true, messageId: '<m@x>' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved, { ...MAILBOX, dailyCap: 2 })
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.message).toContain('Daily limit reached (2)'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const st = loadOutreach(KEY)
    expect(st.enrollments.a.nextStep).toBe(1)
    expect(st.enrollments.b.nextStep).toBe(0)
    expect(st.enrollments.c.nextStep).toBe(0)
    expect(st.sentToday.count).toBe(2)
  })

  it('does not send a step marked as send result unknown', async () => {
    const saved = { a: mk('a') }
    seed((s) => setPending(enroll(s, saved.a, past(1000)), 'a', { step: 0, startedAt: past(500).toISOString() }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.running).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(loadOutreach(KEY).enrollments.a.pendingSend).toBeDefined()
  })

  it('does not send to replied/won/lost leads or leads removed from Saved', async () => {
    const saved = { a: mk('a', 'replied'), b: mk('b', 'won'), c: mk('c', 'lost') }
    seed((s) => {
      let n = s
      for (const id of ['a', 'b', 'c', 'gone']) n = enroll(n, { ...mk(id), lead: { ...mk(id).lead } }, past(1000))
      return n
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.running).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send a follow-up before the delay has passed since the previous send', async () => {
    const saved = { a: mk('a') }
    seed((s) => recordSent(enroll(s, saved.a, past(5 * 86_400_000)), 'a', { step: 0, sentAt: past(86_400_000).toISOString(), subject: 'Q', via: 'smtp', messageId: '<m@x>' }, past(86_400_000)))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.running).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('blocks step 1 for a stale AI pitch: no request, error recorded', async () => {
    const saved = { a: mk('a') }
    seed((s) => enroll(s, saved.a, past(1000)))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved, MAILBOX, stale)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(loadOutreach(KEY).enrollments.a.lastError).toMatch(/Regenerate/))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(loadOutreach(KEY).enrollments.a.nextStep).toBe(0)
  })

  it('stops on access and unavailable errors without trying the next lead', async () => {
    for (const code of ['access', 'unavailable'] as const) {
      window.localStorage.clear()
      const saved = { a: mk('a'), b: mk('b') }
      seed((s) => enroll(enroll(s, saved.a, past(2000)), saved.b, past(1000)))
      const fetchMock = vi.fn(async () => jsonRes({ ok: false, code, error: `E ${code}` }))
      vi.stubGlobal('fetch', fetchMock)
      const { result, unmount } = setup(saved)
      act(() => result.current.runner.runNow())
      await waitFor(() => expect(result.current.runner.status.message).toBe(`E ${code}`))
      expect(fetchMock).toHaveBeenCalledTimes(1)
      unmount()
    }
  })

  it('a suppressed response adds the address to the suppression list and stops the enrollment', async () => {
    const saved = { a: mk('a') }
    seed((s) => enroll(s, saved.a, past(1000)))
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ ok: false, code: 'suppressed', error: 'This address unsubscribed' })))
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(loadOutreach(KEY).suppressed).toEqual(['a@biz.example.com']))
    expect(loadOutreach(KEY).enrollments.a.state).toBe('stopped')
  })

  it('sends the suppression list with each request and never logs the password', async () => {
    const saved = { a: mk('a') }
    seed((s) => ({ ...enroll(s, saved.a, past(1000)), suppressed: ['other@x.example.com'] }))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchMock = vi.fn(async () => jsonRes({ ok: false, code: 'rejected', error: 'The mail server refused the message (code 550).' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(loadOutreach(KEY).enrollments.a.lastError).toBeTruthy())
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.suppressed).toEqual(['other@x.example.com'])
    expect(JSON.stringify([errSpy.mock.calls, logSpy.mock.calls])).not.toContain('secret-pw')
    expect(window.localStorage.getItem(KEY)).not.toContain('secret-pw')
  })

  it('treats a network failure as unavailable, keeps the step due and clears pending', async () => {
    const saved = { a: mk('a') }
    seed((s) => enroll(s, saved.a, past(1000)))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const { result } = setup(saved)
    act(() => result.current.runner.runNow())
    await waitFor(() => expect(result.current.runner.status.running).toBe(false))
    const e = loadOutreach(KEY).enrollments.a
    expect(e.nextStep).toBe(0)
    expect(e.history).toEqual([])
    expect(e.lastError).toBeTruthy()
  })
})
