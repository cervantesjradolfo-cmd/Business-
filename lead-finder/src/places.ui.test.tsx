import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const mk = (n: number, name: string): Lead => ({
  id: `osm:node/${n}`, osmType: 'node', osmId: n, osmUrl: `https://www.openstreetmap.org/node/${n}`,
  name, category: 'Cafe', categoryId: 'cafes', address: '', lat: 1, lon: 1, distanceKm: 1,
})
const jsonRes = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

let searched: string[]
// Each place answers with its own leads; "Nowhere" can't be found; Houston and Dallas share a lead.
function stubApi(opts: { hold?: Promise<void>; denyAll?: boolean } = {}) {
  searched = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    if (url.endsWith('/api/search')) {
      searched.push(body.location)
      if (opts.denyAll) return jsonRes({ error: 'Access key required' }, 401)
      if (body.location === 'Nowhere') return jsonRes({ error: "Couldn't find that location. Try a city name or ZIP code." }, 404)
      if (body.location === 'Dallas, TX' && opts.hold) await opts.hold
      const byPlace: Record<string, Lead[]> = {
        'Houston, TX': [mk(1, 'Bayou Cafe'), mk(9, 'Shared Diner')],
        'San Antonio, TX': [mk(2, 'Alamo Coffee')],
        'Dallas, TX': [mk(3, 'Big D Bakery'), mk(9, 'Shared Diner')],
      }
      return jsonRes({ center: { lat: 1, lon: 1, displayName: body.location }, leads: byPlace[body.location] ?? [], source: 'overpass' })
    }
    if (url.endsWith('/api/audit')) return jsonRes({ results: [] })
    throw new Error('down')
  }))
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function manyPlaces(user: ReturnType<typeof userEvent.setup>, text?: string) {
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Many places' }))
  expect(screen.queryByLabelText('Location')).toBeNull()
  if (text) await user.type(screen.getByLabelText(/Places, one per line/), text)
}

describe('many places search', () => {
  it('fills from a state list, searches each place in order and merges the results once', async () => {
    stubApi()
    const user = userEvent.setup()
    await manyPlaces(user)
    await user.selectOptions(screen.getByLabelText('Fill with'), 'TX')
    expect(screen.getByLabelText(/Places, one per line \(5 of up to 100\)/)).toBeTruthy()
    expect(screen.getByText('Max per place')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Search 5 places' }))
    await waitFor(() => expect(searched).toHaveLength(5))
    expect(searched).toEqual(['Houston, TX', 'San Antonio, TX', 'Dallas, TX', 'Austin, TX', 'Fort Worth, TX'])
    await waitFor(() => expect(screen.getByRole('button', { name: /Results \(4\)/ })).toBeTruthy())
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent).sort()
    expect(names).toEqual(['Alamo Coffee', 'Bayou Cafe', 'Big D Bakery', 'Shared Diner'])
    expect(screen.queryByText(/Couldn't search/)).toBeNull()
  })

  it("keeps going past a place it can't find and names it at the end", async () => {
    stubApi()
    const user = userEvent.setup()
    await manyPlaces(user, 'Nowhere\nSan Antonio, TX')
    await user.click(screen.getByRole('button', { name: 'Search 2 places' }))
    expect(await screen.findByText("Searched 1 of 2 places. Couldn't search: Nowhere.")).toBeTruthy()
    expect(screen.getByText('Alamo Coffee')).toBeTruthy()
  })

  it('shows which place is running and stops on request, keeping what was found', async () => {
    let release!: () => void
    stubApi({ hold: new Promise<void>((r) => { release = r }) })
    const user = userEvent.setup()
    await manyPlaces(user, 'Houston, TX\nDallas, TX\nAustin, TX')
    await user.click(screen.getByRole('button', { name: 'Search 3 places' }))
    expect(await screen.findByText(/Dallas, TX \(2 of 3\): finding businesses/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    release()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull())
    expect(screen.getByText('Bayou Cafe')).toBeTruthy()
    expect(screen.queryByText('Big D Bakery')).toBeNull()
    expect(searched).toEqual(['Houston, TX', 'Dallas, TX'])
  })

  it('stops at once when the access key is missing', async () => {
    stubApi({ denyAll: true })
    const user = userEvent.setup()
    await manyPlaces(user, 'Houston, TX\nDallas, TX')
    await user.click(screen.getByRole('button', { name: 'Search 2 places' }))
    expect(await screen.findByText(/Access key required/)).toBeTruthy()
    expect(searched).toEqual(['Houston, TX'])
  })

  it('needs at least one place, and One place still works as before', async () => {
    stubApi()
    const user = userEvent.setup()
    await manyPlaces(user)
    expect((screen.getByRole('button', { name: 'Search 0 places' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'One place' }))
    await user.type(screen.getByLabelText('Location'), 'Houston, TX')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Bayou Cafe')).toBeTruthy()
    expect(searched).toEqual(['Houston, TX'])
  })
})
