import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const LEAD: Lead = {
  id: 'osm:node/1', osmType: 'node', osmId: 1, osmUrl: 'https://www.openstreetmap.org/node/1',
  name: 'Corner Cafe', category: 'Cafe', categoryId: 'cafes', address: '', city: 'Austin', lat: 1, lon: 1, distanceKm: 1,
}
const now = new Date().toISOString()
const jsonRes = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })

let calls: { path: string; body: any }[]
// /api/pitch and /api/followup answer as the AI would; nothing else exists.
function stubAi(opts: { ai: boolean }) {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/followup')) return jsonRes({ body: opts.ai ? 'Hi Corner Cafe team,\n\nJust bumping this up. Worth a quick chat?' : null })
    if (url.endsWith('/api/pitch') && opts.ai) {
      const sig = 'Sam\nAcme Web\nsam@acme.example.com\n1 Main St, Austin TX'
      return jsonRes({ email: { subject: 'A faster site for Corner Cafe', body: `Hi Corner Cafe team,\n\nAI wrote this.\n\n${sig}\n\nIf you'd rather not hear from me, just reply "no thanks" and I won't email again.` }, sms: 'x', phoneOpener: 'x', source: 'ai' })
    }
    throw new Error('down')
  }))
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }))
  window.localStorage.setItem('leadfinder:saved', JSON.stringify({ [LEAD.id]: { lead: LEAD, status: 'new', notes: '', savedAt: now, updatedAt: now, outreachEmail: 'owner@corner.example.com' } }))
  window.localStorage.setItem('leadfinder:profiles', '[]')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function openOutreach(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Saved \(1\)/ }))
  await user.click(screen.getByText('Corner Cafe'))
  await user.click(await screen.findByRole('button', { name: 'Add to outreach' }))
  await user.click(screen.getByRole('button', { name: /^Outreach \(1\)/ }))
  return screen.getByRole('region', { name: 'Due now' })
}

describe('email preview in Outreach', () => {
  it('shows the exact first email with its signature and opt-out', async () => {
    stubAi({ ai: false })
    const user = userEvent.setup()
    const due = await openOutreach(user)
    await user.click(within(due).getByRole('button', { name: 'Preview first email' }))
    expect(within(due).getByText('Template')).toBeTruthy()
    const body = within(due).getByText(/Hi Corner Cafe team/).textContent!
    expect(body).toContain('1 Main St, Austin TX')
    expect(body).toContain('no thanks')
    expect(within(due).getByText(/^Quick idea for Corner Cafe$/)).toBeTruthy()
  })

  it('writes the first email with AI, and the queued email uses it', async () => {
    stubAi({ ai: true })
    const user = userEvent.setup()
    const due = await openOutreach(user)
    await user.click(within(due).getByRole('button', { name: 'Preview first email' }))
    await user.click(within(due).getByRole('button', { name: /Write with AI|Rewrite with AI/ }))
    await waitFor(() => expect(within(due).getByText('Written by AI')).toBeTruthy())
    expect(within(due).getByText('A faster site for Corner Cafe')).toBeTruthy()
    expect(within(due).getByText(/AI wrote this\./).textContent).toContain('1 Main St, Austin TX')
    const href = within(due).getByRole('link', { name: 'Open in email app' }).getAttribute('href')!
    expect(decodeURIComponent(href)).toContain('subject=A faster site for Corner Cafe')
    expect(within(due).getByRole('button', { name: 'Undo changes' })).toBeTruthy()
    const stored = JSON.parse(window.localStorage.getItem('leadfinder:outreach')!)
    expect(stored.enrollments[LEAD.id].drafts[0]).toEqual({ subject: 'A faster site for Corner Cafe', body: 'Hi Corner Cafe team,\n\nAI wrote this.', source: 'ai' })
  })

  it('says so when AI is not set up, and keeps the wording', async () => {
    stubAi({ ai: false })
    const user = userEvent.setup()
    const due = await openOutreach(user)
    await user.click(within(due).getByRole('button', { name: 'Preview first email' }))
    await user.click(within(due).getByRole('button', { name: 'Write with AI' }))
    expect(await within(due).findByText(/AI writing isn't set up on this site/)).toBeTruthy()
    expect(within(due).getByText('Template')).toBeTruthy()
  })

  it('edits the email by hand; the signature is added back and Undo restores it', async () => {
    stubAi({ ai: false })
    const user = userEvent.setup()
    const due = await openOutreach(user)
    await user.click(within(due).getByRole('button', { name: 'Preview first email' }))
    await user.click(within(due).getByRole('button', { name: 'Edit' }))
    const message = within(due).getByLabelText('Message') as HTMLTextAreaElement
    expect(message.value).not.toContain('no thanks') // footer is not editable
    await user.clear(message)
    await user.click(within(due).getByRole('button', { name: 'Save email' }))
    expect(within(due).getByRole('alert').textContent).toBe('The email needs some text.')
    await user.type(message, 'Hello from Sam.')
    await user.clear(within(due).getByLabelText('Subject'))
    await user.type(within(due).getByLabelText('Subject'), 'My own subject')
    await user.click(within(due).getByRole('button', { name: 'Save email' }))
    expect(within(due).getByText('Edited')).toBeTruthy()
    expect(within(due).getByText(/Hello from Sam\./).textContent).toContain('no thanks')
    expect(decodeURIComponent(within(due).getByRole('link', { name: 'Open in email app' }).getAttribute('href')!)).toContain('subject=My own subject')

    await user.click(within(due).getByRole('button', { name: 'Mark as sent' }))
    const stored = JSON.parse(window.localStorage.getItem('leadfinder:outreach')!)
    expect(stored.enrollments[LEAD.id].history[0].subject).toBe('My own subject')
  })

  it('writes a follow-up with AI from the email that was sent', async () => {
    stubAi({ ai: true })
    const user = userEvent.setup()
    const due = await openOutreach(user)
    await user.click(within(due).getByRole('button', { name: 'Mark as sent' }))
    const inOutreach = screen.getByRole('region', { name: 'In outreach' })
    await user.click(within(inOutreach).getByRole('button', { name: 'Preview follow-up 1' }))
    // Opening the lead already fetched the AI pitch, so step 1 went out with the AI subject.
    expect(within(inOutreach).getByText('Re: A faster site for Corner Cafe')).toBeTruthy()
    expect(within(inOutreach).getByText(/wanted to follow up/).textContent).toContain('no thanks')
    await user.click(within(inOutreach).getByRole('button', { name: 'Write with AI' }))
    await waitFor(() => expect(within(inOutreach).getByText(/Just bumping this up/)).toBeTruthy())
    expect(within(inOutreach).getByText('Written by AI')).toBeTruthy()
    const req = calls.find((c) => c.path.endsWith('/api/followup'))!.body
    expect(req).toMatchObject({ step: 1, previousSubject: 'A faster site for Corner Cafe', lead: { name: 'Corner Cafe', city: 'Austin' }, sender: { name: 'Sam', business: 'Acme Web' } })
    expect(req.previousBody).toBe('Hi Corner Cafe team,\n\nAI wrote this.')
    expect(req.previousBody).not.toContain('no thanks')
    await user.click(within(inOutreach).getByRole('button', { name: 'Undo changes' }))
    expect(within(inOutreach).getByText('Template')).toBeTruthy()
  })
})
