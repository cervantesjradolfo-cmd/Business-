import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const mk = (n: number, p: Partial<Lead>): Lead => ({
  id: `osm:node/${n}`, osmType: 'node', osmId: n, osmUrl: `https://www.openstreetmap.org/node/${n}`,
  name: `Biz ${n}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 1, lon: 1, distanceKm: n, ...p,
})
const jsonRes = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

let headersSeen: Record<string, string>[]
function stubApi(leads: Lead[], search?: () => Response) {
  headersSeen = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    headersSeen.push({ path: url, ...((init?.headers as Record<string, string>) ?? {}) })
    if (url.endsWith('/api/search')) return search ? search() : jsonRes({ center: { lat: 1, lon: 1, displayName: 'X' }, leads, source: 'overpass' })
    if (url.endsWith('/api/audit')) return jsonRes({ results: [] })
    return new Response('nope', { status: 500 })
  }))
}
async function search(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Location'), 'Austin')
  await user.click(screen.getByRole('button', { name: 'Search' }))
}
beforeEach(() => window.localStorage.clear())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const PLAIN = mk(1, { name: 'Plain Cafe' })
const C1 = mk(2, { name: 'Brand One', brand: 'B', isChain: true })
const C2 = mk(3, { name: 'Brand Two', brand: 'B', isChain: true })
const C3 = mk(4, { name: 'Brand Three', brandWikidata: 'Q1', isChain: true })

describe('chains in the UI', () => {
  it('count in the label matches the number of chains and the toggle re-hides them', async () => {
    stubApi([PLAIN, C1, C2, C3])
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Plain Cafe')
    const box = screen.getByRole('checkbox', { name: 'Show chains (3)' }) as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByText('Showing 1 of 4')).toBeTruthy()
    await user.click(box)
    expect(box.checked).toBe(true)
    expect(screen.getByText('Showing 4 of 4')).toBeTruthy()
    expect(screen.getAllByText('Chain / franchise')).toHaveLength(3)
    await user.click(box)
    expect(screen.getByText('Showing 1 of 4')).toBeTruthy()
    expect(screen.queryByText('Brand One')).toBeNull()
  })

  it('only chains found: list is empty by default but the toggle is offered and reveals them', async () => {
    stubApi([C1, C2])
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    const box = await screen.findByRole('checkbox', { name: 'Show chains (2)' })
    expect(screen.queryByText('Brand One')).toBeNull()
    await user.click(box)
    expect(screen.getByText('Brand One')).toBeTruthy()
  })

  it('a non-chain lead has no "Chain / franchise" chip', async () => {
    stubApi([PLAIN, C1])
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Plain Cafe')
    expect(screen.queryByText('Chain / franchise')).toBeNull()
  })

  it('saved chains stay visible on the Saved tab without the toggle, and the toggle is not offered there', async () => {
    window.localStorage.setItem('leadfinder:saved', JSON.stringify({ [C1.id]: { lead: C1, status: 'new', notes: '' } }))
    stubApi([PLAIN])
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Saved \(1\)/ }))
    expect(screen.getByRole('heading', { level: 3, name: 'Brand One' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /Show chains/ })).toBeNull()
    expect(screen.getByText('Showing 1 of 1')).toBeTruthy()
  })

  it('combines with "No website only"', async () => {
    const withSite = mk(5, { name: 'Has Site', website: 'https://x.example.com' })
    stubApi([PLAIN, withSite, C1])
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Plain Cafe')
    await user.click(screen.getByRole('checkbox', { name: 'Show chains (1)' }))
    await user.click(screen.getByRole('checkbox', { name: 'No website only' }))
    expect(screen.getByText('Brand One')).toBeTruthy()
    expect(screen.queryByText('Has Site')).toBeNull()
  })
})

describe('access key in the UI', () => {
  it('sends no x-access-key header when none is stored', async () => {
    stubApi([PLAIN])
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Plain Cafe')
    expect(headersSeen.length).toBeGreaterThan(0)
    expect(headersSeen.every((h) => !('x-access-key' in h))).toBe(true)
  })

  it('shows the access-key message on a 401 (missing or wrong key), not the demo offer', async () => {
    stubApi([], () => jsonRes({ error: 'Access key required' }, 401))
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    expect(await screen.findByText(/Access key required\. Add your access key under "Your details"/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Explore demo data' })).toBeNull()
  })

  it('entering the key under Your details stores it and sends it on the next search', async () => {
    stubApi([PLAIN])
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Your details/ }))
    const field = screen.getByLabelText(/Access key/) as HTMLInputElement
    expect(field.type).toBe('password')
    await user.type(field, 'sekret')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(window.localStorage.getItem('leadfinder:accessKey')).toBe('sekret')
    // never mixed into the sender object that goes into pitch requests
    expect(window.localStorage.getItem('leadfinder:sender') ?? '').not.toContain('sekret')
    await search(user)
    await screen.findByText('Plain Cafe')
    expect(headersSeen.find((h) => h.path.endsWith('/api/search'))?.['x-access-key']).toBe('sekret')
  })
})
