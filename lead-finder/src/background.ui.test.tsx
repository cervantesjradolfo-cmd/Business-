import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const LEAD: Lead = { id: 'osm:node/1', osmType: 'node', osmId: 1, osmUrl: 'x', name: 'Corner Cafe', category: 'Cafe', categoryId: 'cafes', address: '', city: 'Austin', lat: 1, lon: 1, distanceKm: 1 }
const enrolledAt = new Date(Date.now() - 86_400_000).toISOString()
const sentAt = new Date(Date.now() - 3_600_000).toISOString()
const jsonRes = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
let calls: { path: string; body: any }[]

const serverOutreach = {
  campaign: { followUps: [] }, suppressed: [], sentToday: { day: '', count: 0 }, replies: {},
  enrollments: { [LEAD.id]: { leadId: LEAD.id, email: 'owner@corner.example.com', enrolledAt, nextStep: 1, state: 'finished', subject: 'Hi', history: [{ step: 0, sentAt, subject: 'Hi', via: 'smtp', messageId: '<m1@x>' }] } },
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }))
  window.localStorage.setItem('leadfinder:profiles', '[]')
  window.localStorage.setItem('leadfinder:saved', JSON.stringify({ [LEAD.id]: { lead: LEAD, status: 'new', notes: '', savedAt: enrolledAt, updatedAt: enrolledAt, outreachEmail: 'owner@corner.example.com' } }))
  window.localStorage.setItem('leadfinder:mailbox', JSON.stringify({ host: 'smtp.gmail.com', port: 465, user: 'sam@acme.example.com', pass: 'app-pw', fromName: 'Sam', fromAddress: 'sam@acme.example.com' }))
  window.localStorage.setItem('leadfinder:outreach', JSON.stringify({
    campaign: { followUps: [] }, suppressed: [], sentToday: { day: '', count: 0 },
    enrollments: { [LEAD.id]: { leadId: LEAD.id, email: 'owner@corner.example.com', enrolledAt, nextStep: 0, state: 'active', history: [] } },
  }))
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/background')) {
      if (body.action === 'status') return jsonRes({ available: true, enabled: false })
      if (body.action === 'sync') return jsonRes({ available: true, enabled: true, outreach: serverOutreach, events: [{ leadId: LEAD.id, status: 'contacted', at: sentAt }], lastRunAt: sentAt, lastRunNote: 'sent 1' })
      if (body.action === 'run') return jsonRes({ note: 'nothing due', available: true, enabled: true })
      if (body.action === 'disable') return jsonRes({ available: true, enabled: false, outreach: serverOutreach, events: [] })
    }
    throw new Error('down')
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('run while the app is closed', () => {
  it('turns on with your copy, takes the server sends and statuses, runs now and turns off', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach/ }))
    const panel = screen.getByRole('region', { name: 'Run while closed' })
    await user.click(await within(panel).findByRole('button', { name: 'Turn on' }))
    expect(await within(panel).findByText(/^On\./)).toBeTruthy()

    const sync = calls.find((c) => c.body?.action === 'sync')!.body
    expect(sync).toMatchObject({ workspace: 'agency', mailbox: { host: 'smtp.gmail.com', pass: 'app-pw' }, leads: { [LEAD.id]: { name: 'Corner Cafe', status: 'new', pitch: { email: { subject: expect.any(String) } } } } })
    expect(sync.outreach.enrollments[LEAD.id].nextStep).toBe(0)

    // The server's send is now in the browser, and the lead is Contacted.
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('leadfinder:outreach')!).enrollments[LEAD.id].history).toHaveLength(1))
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)[LEAD.id].status).toBe('contacted'))
    expect(within(panel).getByText(/Last run .*: sent 1\./)).toBeTruthy()
    // The tab no longer sends on its own.
    expect(screen.queryByRole('button', { name: 'Send due emails' })).toBeNull()
    expect(screen.queryByLabelText('Auto-send while this tab is open')).toBeNull()

    await user.click(within(panel).getByRole('button', { name: 'Run now' }))
    expect(await within(panel).findByText('Run now: nothing due.')).toBeTruthy()

    await user.click(within(panel).getByRole('button', { name: 'Turn off' }))
    expect(await within(panel).findByRole('button', { name: 'Turn on' })).toBeTruthy()
    expect(calls.some((c) => c.body?.action === 'disable')).toBe(true)
  })

  it('explains what to set up when the server has no database', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/api/background') ? jsonRes({ available: false, enabled: false }) : new Response('x', { status: 500 }))))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach/ }))
    expect(within(screen.getByRole('region', { name: 'Run while closed' })).getByText(/Not set up on the server yet/)).toBeTruthy()
  })
})
