import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const LEAD: Lead = {
  id: 'osm:node/1', osmType: 'node', osmId: 1, osmUrl: 'https://www.openstreetmap.org/node/1',
  name: 'Corner Cafe', category: 'Cafe', categoryId: 'cafes', address: '', city: 'Austin', lat: 1, lon: 1, distanceKm: 1,
}
const sentAt = new Date(Date.now() - 2 * 86_400_000).toISOString()
const jsonRes = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const MESSAGE = {
  id: '<r1@corner>', from: 'owner@corner.example.com', fromName: 'Pat', subject: 'Re: A website for Corner Cafe', date: new Date().toISOString(),
  messageId: '<r1@corner>', refs: ['<sent1@acme>'], text: 'Sounds good. How much would it cost?', auto: false,
}

let calls: { path: string; body: any }[]
function stub(o: { ai: boolean; messages?: unknown[]; integrations?: boolean }) {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/integrations')) return jsonRes({ slack: !!o.integrations, webhook: false, hubspot: !!o.integrations, ghl: false })
    if (url.endsWith('/api/integrations?op=notify')) return jsonRes({ sent: ['Slack'], failed: [] })
    if (url.endsWith('/api/integrations?op=crm')) return jsonRes({ hubspot: { sent: body.leads.length, skipped: 0 } })
    if (url.endsWith('/api/inbox')) return jsonRes({ ok: true, messages: o.messages ?? [MESSAGE] })
    if (url.endsWith('/api/reply')) return jsonRes({ draft: o.ai ? { intent: 'question', summary: 'Asks the price', body: 'Hi Pat,\n\nA new site usually runs $1,500 to $5,000. Free for a quick call Thursday?' } : null })
    if (url.endsWith('/api/send')) return jsonRes({ ok: true, messageId: '<answer@acme>' })
    throw new Error('down')
  }))
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }))
  window.localStorage.setItem('leadfinder:saved', JSON.stringify({ [LEAD.id]: { lead: LEAD, status: 'contacted', notes: '', savedAt: sentAt, updatedAt: sentAt, outreachEmail: 'owner@corner.example.com' } }))
  window.localStorage.setItem('leadfinder:profiles', '[]')
  window.localStorage.setItem('leadfinder:mailbox', JSON.stringify({ host: 'smtp.gmail.com', port: 465, user: 'sam@acme.example.com', pass: 'app-pw', fromName: 'Sam', fromAddress: 'sam@acme.example.com', gapSeconds: 45, dailyCap: 30 }))
  window.localStorage.setItem('leadfinder:outreach', JSON.stringify({
    campaign: { followUps: [{ delayDays: 3, body: 'Hi {{business}} team, following up.' }] },
    enrollments: { [LEAD.id]: { leadId: LEAD.id, email: 'owner@corner.example.com', enrolledAt: sentAt, nextStep: 1, state: 'active', subject: 'A website for Corner Cafe', history: [{ step: 0, sentAt, subject: 'A website for Corner Cafe', via: 'smtp', messageId: '<sent1@acme>' }] } },
    suppressed: [], sentToday: { day: '', count: 0 },
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function checkReplies(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(screen.getByRole('button', { name: /^Outreach/ }))
  const panel = screen.getByRole('region', { name: 'Replies' })
  await user.click(within(panel).getByRole('button', { name: 'Check for replies' }))
  await within(panel).findByText('Sounds good. How much would it cost?')
  return panel
}

describe('replies', () => {
  it('finds a reply, marks the lead Replied, drafts an answer with AI and sends it in the thread', async () => {
    stub({ ai: true })
    const user = userEvent.setup()
    const panel = await checkReplies(user)

    const inbox = calls.find((c) => c.path.endsWith('/api/inbox'))!
    expect(inbox.body).toMatchObject({ imap: { host: 'imap.gmail.com', user: 'sam@acme.example.com', pass: 'app-pw' }, addresses: ['owner@corner.example.com'], messageIds: ['<sent1@acme>'] })
    expect(within(panel).getByText('1 new reply')).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)[LEAD.id].status).toBe('replied')
    expect(JSON.parse(window.localStorage.getItem('leadfinder:outreach')!).enrollments[LEAD.id]).toMatchObject({ state: 'stopped', stopReason: 'replied' })

    const answer = await within(panel).findByDisplayValue(/usually runs \$1,500 to \$5,000/) as HTMLTextAreaElement
    expect(within(panel).getByText('Has a question')).toBeTruthy()
    expect(within(panel).getByText('Asks the price')).toBeTruthy()
    const reply = calls.find((c) => c.path.endsWith('/api/reply'))!
    expect(reply.body).toMatchObject({ theirReply: 'Sounds good. How much would it cost?', ourEmail: { subject: 'A website for Corner Cafe' }, lead: { name: 'Corner Cafe' } })

    // An edit, then Rewrite with AI: the rewrite replaces the edit.
    await user.type(answer, ' Typo')
    await user.click(within(panel).getByRole('button', { name: 'Rewrite with AI' }))
    await waitFor(() => expect(answer.value).not.toContain('Typo'))
    await user.type(answer, ' Thanks!')
    await user.click(within(panel).getByRole('button', { name: 'Send answer' }))
    await waitFor(() => expect(within(panel).getByText('Replies (0)')).toBeTruthy())
    const send = calls.find((c) => c.path.endsWith('/api/send'))!
    expect(send.body).toMatchObject({ to: 'owner@corner.example.com', subject: 'Re: A website for Corner Cafe', inReplyTo: '<r1@corner>' })
    expect(send.body.text).toMatch(/^Hi Pat,\n\nA new site usually runs \$1,500 to \$5,000\. Free for a quick call Thursday\? Thanks!\n\nSam/)
    expect(send.body.text).toContain('> Sounds good. How much would it cost?')

    await user.click(within(panel).getByRole('button', { name: /Show handled replies \(1\)/ }))
    expect(within(panel).getByText(/Answered$/)).toBeTruthy()
  })

  it('lets you write the answer yourself when AI is off', async () => {
    stub({ ai: false })
    const user = userEvent.setup()
    const panel = await checkReplies(user)
    await user.click(within(panel).getByRole('button', { name: 'Write with AI' }))
    expect(await within(panel).findByText(/AI writing isn't set up/)).toBeTruthy()
    const send = within(panel).getByRole('button', { name: 'Send answer' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    await user.type(within(panel).getByPlaceholderText('Write your answer'), 'Hi Pat, about $1,500.')
    expect(send.disabled).toBe(false)
    await user.click(within(panel).getByRole('button', { name: 'No answer needed' }))
    expect(within(panel).getByText('Replies (0)')).toBeTruthy()
  })

  it('adds your booking link to the answer, and Meeting booked sets the lead to booked', async () => {
    stub({ ai: false })
    window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '', bookingUrl: 'https://cal.com/sam' }))
    const user = userEvent.setup()
    const panel = await checkReplies(user)
    await user.type(within(panel).getByPlaceholderText('Write your answer'), 'Hi Pat, happy to chat.')
    await user.click(within(panel).getByRole('button', { name: 'Add booking link' }))
    expect((within(panel).getByPlaceholderText('Write your answer') as HTMLTextAreaElement).value)
      .toBe('Hi Pat, happy to chat.\n\nYou can pick a time that suits you here: https://cal.com/sam')
    expect(within(panel).queryByRole('button', { name: 'Add booking link' })).toBeNull()
    await user.click(within(panel).getByRole('button', { name: 'Meeting booked' }))
    expect(within(panel).getByText('Replies (0)')).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)[LEAD.id].status).toBe('booked')
  })

  it('alerts Slack and updates the CRM for a new reply and for a booking, when they are set up', async () => {
    stub({ ai: true, integrations: true })
    const user = userEvent.setup()
    const panel = await checkReplies(user)
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/api/integrations?op=notify'))).toBe(true))
    expect(calls.find((c) => c.path.endsWith('/api/integrations?op=notify'))!.body).toMatchObject({
      event: 'reply', lead: { name: 'Corner Cafe', email: 'owner@corner.example.com' }, from: 'owner@corner.example.com', intent: 'question', summary: 'Asks the price',
    })
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/api/integrations?op=crm'))).toBe(true))
    expect(calls.find((c) => c.path.endsWith('/api/integrations?op=crm'))!.body.leads).toEqual([expect.objectContaining({ name: 'Corner Cafe', email: 'owner@corner.example.com', status: 'replied' })])

    await user.click(within(panel).getByRole('button', { name: 'Meeting booked' }))
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith('/api/integrations?op=notify')).map((c) => c.body.event)).toEqual(['reply', 'booked']))
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith('/api/integrations?op=crm')).map((c) => c.body.leads[0].status)).toEqual(['replied', 'booked']))

    const section = screen.getByRole('region', { name: 'Alerts and CRM' })
    expect(within(section).getAllByLabelText('Connected')).toHaveLength(2)
    await user.click(within(section).getByRole('button', { name: 'Send all saved leads to CRM (1)' }))
    expect(await within(section).findByText('HubSpot: 1 sent')).toBeTruthy()
  })

  it('sends no alerts or CRM updates when nothing is set up', async () => {
    stub({ ai: true })
    const user = userEvent.setup()
    await checkReplies(user)
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/api/reply'))).toBe(true))
    expect(calls.some((c) => c.path.endsWith('/api/integrations?op=notify') || c.path.endsWith('/api/integrations?op=crm'))).toBe(false)
    expect(screen.queryByRole('button', { name: /Send all saved leads to CRM/ })).toBeNull()
  })

  it('unsubscribes a "no thanks" reply without asking you', async () => {
    stub({ ai: true, messages: [{ ...MESSAGE, text: 'No thanks.' }] })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach/ }))
    const panel = screen.getByRole('region', { name: 'Replies' })
    await user.click(within(panel).getByRole('button', { name: 'Check for replies' }))
    expect(await within(panel).findByText('1 new reply, 1 unsubscribed')).toBeTruthy()
    expect(within(panel).getByText('Replies (0)')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Unsubscribed addresses' })).getByText('owner@corner.example.com')).toBeTruthy()
    expect(calls.some((c) => c.path.endsWith('/api/reply'))).toBe(false)
  })
})
