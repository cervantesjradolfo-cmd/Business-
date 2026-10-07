import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const mkLead = (n: number, extra: Partial<Lead> = {}): Lead => ({
  id: `osm:node/${n}`, osmType: 'node', osmId: n, osmUrl: `https://www.openstreetmap.org/node/${n}`,
  name: `Cafe ${n}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 1, lon: 1, distanceKm: 1, ...extra,
})
const now = new Date().toISOString()
const savedOf = (...leads: Lead[]) => JSON.stringify(Object.fromEntries(leads.map((l) => [l.id, { lead: l, status: 'new', notes: '', savedAt: now, updatedAt: now }])))
const profileSelect = () => screen.getByLabelText('Finding leads for') as HTMLSelectElement
const store = (k: string) => JSON.parse(window.localStorage.getItem(k)!)

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }))
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function openSaved(user: ReturnType<typeof userEvent.setup>, count: number) {
  await user.click(screen.getByRole('button', { name: new RegExp(`Saved \\(${count}\\)`) }))
}

describe('outreach UI', () => {
  it('manual mode offers an Open in email app link to the lead address', async () => {
    window.localStorage.setItem('leadfinder:saved', savedOf(mkLead(1, { email: 'owner@one.example.com; other@one.example.com' })))
    const user = userEvent.setup()
    render(<App />)
    await openSaved(user, 1)
    await user.click(screen.getByText('Cafe 1'))
    // prefilled with the first address
    expect((await screen.findByLabelText('Email for outreach') as HTMLInputElement).value).toBe('owner@one.example.com')
    await user.click(screen.getByRole('button', { name: 'Add to outreach' }))
    await user.click(screen.getByRole('button', { name: /^Outreach \(1\)/ }))
    const due = screen.getByRole('region', { name: 'Due now' })
    const link = within(due).getByRole('link', { name: 'Open in email app' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toMatch(/^mailto:owner@one\.example\.com\?subject=/)
    expect(link.getAttribute('href')).toContain('%0D%0A')
    // opening the mail app alone does not advance the sequence
    expect(store('leadfinder:outreach').enrollments['osm:node/1'].nextStep).toBe(0)
  })

  it('refuses a second lead with the same address', async () => {
    window.localStorage.setItem('leadfinder:saved', savedOf(mkLead(1, { email: 'same@x.example.com' }), mkLead(2, { email: 'SAME@x.example.com' })))
    const user = userEvent.setup()
    render(<App />)
    await openSaved(user, 2)
    await user.click(screen.getByText('Cafe 1'))
    await user.click(await screen.findByRole('button', { name: 'Add to outreach' }))
    await user.click(screen.getByText('Cafe 2'))
    const add = await screen.findByRole('button', { name: 'Add to outreach' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    expect(screen.getByText('Another lead in outreach uses this address')).toBeTruthy()
  })

  it('Unsubscribed adds the address to the suppression list and stops the lead', async () => {
    window.localStorage.setItem('leadfinder:saved', savedOf(mkLead(1, { email: 'Owner@One.example.com' })))
    const user = userEvent.setup()
    render(<App />)
    await openSaved(user, 1)
    await user.click(screen.getByText('Cafe 1'))
    await user.click(await screen.findByRole('button', { name: 'Add to outreach' }))
    await user.click(screen.getByRole('button', { name: /^Outreach \(1\)/ }))
    const list = screen.getByRole('region', { name: 'In outreach' })
    await user.click(within(list).getByRole('button', { name: 'Unsubscribed' }))
    const st = store('leadfinder:outreach')
    expect(st.suppressed).toEqual(['owner@one.example.com'])
    expect(st.enrollments['osm:node/1']).toMatchObject({ state: 'stopped', stopReason: 'unsubscribed' })
    expect(screen.getByText('Due now (0)')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Unsubscribed addresses' })).getByText('owner@one.example.com')).toBeTruthy()
  })

  it('stops the sequence when the lead is marked Replied', async () => {
    window.localStorage.setItem('leadfinder:saved', savedOf(mkLead(1, { email: 'o@one.example.com' })))
    const user = userEvent.setup()
    render(<App />)
    await openSaved(user, 1)
    await user.click(screen.getByText('Cafe 1'))
    await user.click(await screen.findByRole('button', { name: 'Add to outreach' }))
    const saved = store('leadfinder:saved')
    saved['osm:node/1'].status = 'replied'
    cleanup()
    window.localStorage.setItem('leadfinder:saved', JSON.stringify(saved))
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach \(0\)/ }))
    expect(store('leadfinder:outreach').enrollments['osm:node/1']).toMatchObject({ state: 'stopped', stopReason: 'replied' })
  })

  it('Remove from outreach deletes the enrollment so the address can be reused', async () => {
    window.localStorage.setItem('leadfinder:saved', savedOf(mkLead(1, { email: 'o@one.example.com' })))
    const user = userEvent.setup()
    render(<App />)
    await openSaved(user, 1)
    await user.click(screen.getByText('Cafe 1'))
    await user.click(await screen.findByRole('button', { name: 'Add to outreach' }))
    await user.click(screen.getByRole('button', { name: /^Outreach \(1\)/ }))
    await user.click(within(screen.getByRole('region', { name: 'In outreach' })).getByRole('button', { name: 'Remove from outreach' }))
    expect(store('leadfinder:outreach').enrollments).toEqual({})
  })

  it('keeps outreach data per profile, and never shows another profile its enrollments or mailbox', async () => {
    window.localStorage.setItem('leadfinder:saved:asher-construction', savedOf(mkLead(7, { email: 'asher@one.example.com' })))
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    await openSaved(user, 1)
    await user.click(screen.getByText('Cafe 7'))
    await user.click(await screen.findByRole('button', { name: 'Add to outreach' }))
    expect(window.localStorage.getItem('leadfinder:outreach')).toBeNull()
    expect(store('leadfinder:outreach:asher-construction').enrollments['osm:node/7']).toBeTruthy()

    await user.selectOptions(profileSelect(), '')
    expect(screen.getByRole('button', { name: /^Outreach \(0\)/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Outreach \(0\)/ }))
    expect(screen.getByText('No leads in outreach yet.')).toBeTruthy()
    expect(screen.queryByText('asher@one.example.com')).toBeNull()
    expect(window.localStorage.getItem('leadfinder:outreach')).toBeNull()
  })

  it('deleting a profile removes its outreach and mailbox keys but not other profiles or the agency', async () => {
    const ls = window.localStorage
    ls.setItem('leadfinder:outreach:asher-construction', '{"enrollments":{}}')
    ls.setItem('leadfinder:mailbox:asher-construction', '{"pass":"pw"}')
    ls.setItem('leadfinder:saved:asher-construction', '{}')
    ls.setItem('leadfinder:outreach', '{"enrollments":{}}')
    ls.setItem('leadfinder:mailbox', '{"pass":"mine"}')
    ls.setItem('leadfinder:outreach:other', '{}')
    ls.setItem('leadfinder:mailbox:other', '{}')
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    await user.click(screen.getByRole('button', { name: /Profile details/ }))
    await user.click(screen.getByRole('button', { name: 'Delete profile' }))
    await user.click(screen.getByRole('button', { name: 'Delete profile and its saved leads' }))
    expect(ls.getItem('leadfinder:outreach:asher-construction')).toBeNull()
    expect(ls.getItem('leadfinder:mailbox:asher-construction')).toBeNull()
    expect(ls.getItem('leadfinder:saved:asher-construction')).toBeNull()
    expect(ls.getItem('leadfinder:outreach')).not.toBeNull()
    expect(ls.getItem('leadfinder:mailbox')).toBe('{"pass":"mine"}')
    expect(ls.getItem('leadfinder:outreach:other')).not.toBeNull()
    expect(ls.getItem('leadfinder:mailbox:other')).not.toBeNull()
  })

  it('never renders the saved mailbox password as text and masks the input', async () => {
    window.localStorage.setItem('leadfinder:mailbox', JSON.stringify({ host: 'smtp.gmail.com', port: 465, user: 'u@gmail.com', pass: 'sup3r-secret-pw', fromName: 'Sam', fromAddress: 'u@gmail.com', gapSeconds: 45, dailyCap: 30 }))
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach/ }))
    const pw = screen.getByLabelText(/password/i) as HTMLInputElement
    expect(pw.type).toBe('password')
    expect(container.textContent).not.toContain('sup3r-secret-pw')
    expect(screen.queryByText(/No mailbox set up/)).toBeNull()
  })
})
