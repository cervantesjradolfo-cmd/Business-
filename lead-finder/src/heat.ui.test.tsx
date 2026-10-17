import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const mk = (n: number, p: Partial<Lead>): Lead => ({
  id: `osm:node/${n}`, osmType: 'node', osmId: n, osmUrl: `https://www.openstreetmap.org/node/${n}`,
  name: `Biz ${n}`, category: 'Cafe', categoryId: 'cafes', address: '1 Main St', lat: 1, lon: 1, distanceKm: n, ...p,
})
const CALM = mk(1, { name: 'Calm Cafe', website: 'https://calm.example.com' })
const HIRING = mk(2, { name: 'Hiring Cafe', website: 'https://hiring.example.com' })
const jsonRes = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
let calls: { path: string; body: any }[]

beforeEach(() => {
  window.localStorage.clear()
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/integrations')) return jsonRes({ slack: false, webhook: false, hubspot: false, ghl: false, places: true })
    if (url.endsWith('/api/search')) return jsonRes({ center: { lat: 1, lon: 1, displayName: 'X' }, leads: [CALM, HIRING], source: 'overpass' })
    if (url.endsWith('/api/audit')) {
      return jsonRes({ results: body.leads.map((l: { id: string }) => ({ id: l.id, status: 'ok', gaps: [], checkedAt: '2026-10-01T00:00:00Z', ...(l.id === HIRING.id ? { signals: ['hiring', 'new_opening'] } : {}) })) })
    }
    if (url.endsWith('/api/reviews')) return jsonRes({ reviews: { rating: 3.6, count: 40, checkedAt: '2026-10-17T00:00:00Z' } })
    return new Response('nope', { status: 500 })
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('heat', () => {
  it('shows heat on cards and in the lead panel, filters heat 4+, and adds Google reviews on request', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Location'), 'Austin')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Heat 5')).toBeTruthy()

    await user.click(screen.getByLabelText('Heat 4+ only'))
    expect(screen.queryByText('Calm Cafe')).toBeNull()
    await user.click(screen.getByLabelText('Heat 4+ only'))

    await user.click(screen.getByText('Hiring Cafe'))
    const why = screen.getByRole('region', { name: 'Why now' })
    expect(within(why).getByText('Heat 5 of 5')).toBeTruthy()
    expect(within(why).getByText('Hiring (says so on their website)')).toBeTruthy()

    await user.click(screen.getByText('Calm Cafe'))
    const calm = screen.getByRole('region', { name: 'Why now' })
    expect(within(calm).getByText('Heat 1 of 5')).toBeTruthy()
    await user.click(within(calm).getByRole('button', { name: 'Check Google reviews' }))
    expect(await within(calm).findByText(/3\.6 on Google from 40 reviews/)).toBeTruthy()
    expect(within(calm).getByText('Heat 3 of 5')).toBeTruthy()
    expect(calls.find((c) => c.path.endsWith('/api/reviews'))!.body).toEqual({ name: 'Calm Cafe', address: '1 Main St', lat: 1, lon: 1 })
    // Checking reviews saves the lead, with the reviews.
    expect(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)[CALM.id].lead.reviews).toMatchObject({ rating: 3.6, count: 40 })
  })
})
