import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const LEAD: Lead = {
  id: 'osm:node/1', osmType: 'node', osmId: 1, osmUrl: 'https://www.openstreetmap.org/node/1',
  name: 'Corner Cafe', category: 'Cafe', categoryId: 'cafes', address: '', lat: 1, lon: 1, distanceKm: 1,
}
const now = new Date().toISOString()

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }))
  window.localStorage.setItem('leadfinder:saved', JSON.stringify({ [LEAD.id]: { lead: LEAD, status: 'new', notes: '', savedAt: now, updatedAt: now } }))
  window.localStorage.setItem('leadfinder:profiles', '[]')
  // no backend: the pitch falls back to the template
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('outreach', () => {
  it('enrolls a saved lead, lists it as due and advances it when marked as sent', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Saved \(1\)/ }))
    await user.click(screen.getByText('Corner Cafe'))

    const add = await screen.findByRole('button', { name: 'Add to outreach' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    expect(screen.getByText('Add a valid email for outreach')).toBeTruthy()
    await user.type(screen.getByLabelText('Email for outreach'), 'owner@corner.example.com')
    expect(add.disabled).toBe(false)
    await user.click(add)
    expect(screen.getByText(/Step 1 of 3 due/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^Outreach \(1\)/ }))
    const due = screen.getByRole('region', { name: 'Due now' })
    expect(within(due).getByText('Due now (1)')).toBeTruthy()
    expect(screen.getByText(/No mailbox set up/)).toBeTruthy()
    expect(within(due).getByText('owner@corner.example.com')).toBeTruthy()

    await user.click(within(due).getByRole('button', { name: 'Mark as sent' }))
    expect(screen.getByText('Due now (0)')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Outreach \(0\)/ })).toBeTruthy()
    expect(screen.getByText(/Step 2 of 3 due/)).toBeTruthy()

    const stored = JSON.parse(window.localStorage.getItem('leadfinder:outreach')!)
    expect(stored.enrollments[LEAD.id]).toMatchObject({ nextStep: 1, email: 'owner@corner.example.com' })
    expect(stored.enrollments[LEAD.id].history[0]).toMatchObject({ step: 0, via: 'manual' })
    expect(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)[LEAD.id].status).toBe('contacted')
  })
})
