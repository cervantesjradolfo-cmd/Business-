import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Lead } from './lib/types'

const mk = (n: number, p: Partial<Lead>): Lead => ({
  id: `osm:node/${n}`, osmType: 'node', osmId: n, osmUrl: `https://www.openstreetmap.org/node/${n}`,
  name: `Biz ${n}`, category: 'General contractor', categoryId: 'general_contractors', address: '', lat: 1, lon: 1, distanceKm: n, ...p,
})
// Nearest first, but Summit has the most ways to reach it.
const PEAK = mk(1, { name: 'Peak Builders' })
const SUMMIT = mk(2, { name: 'Summit Construction', phone: '+1 555-0102', email: 'office@summit.example.com', website: 'https://summit.example.com' })
const RIDGE = mk(3, { name: 'Ridge Homes', phone: '+1 555-0103' })

const jsonRes = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
let calls: { path: string; body: any }[]
function stubApi() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/search')) return jsonRes({ center: { lat: 1, lon: 1, displayName: 'X' }, leads: [PEAK, SUMMIT, RIDGE], source: 'overpass' })
    if (url.endsWith('/api/audit')) return jsonRes({ results: [] })
    throw new Error('pitch down') // falls back to the template
  }))
}

const profileSelect = () => screen.getByLabelText('Finding leads for') as HTMLSelectElement
async function search(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Location'), 'Denver')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await screen.findByText('Peak Builders')
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('client profiles', () => {
  it('starts on My agency with Asher Construction ready to pick', () => {
    stubApi()
    render(<App />)
    expect(profileSelect().value).toBe('')
    expect(within(profileSelect()).getByRole('option', { name: 'Asher Construction' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Your details/ })).toBeTruthy()
  })

  it("searches Asher's customer types, skips website audits and ranks by contact details", async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    expect(await screen.findByText('Find customers for Asher Construction')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Profile details/ })).toBeTruthy()
    const category = screen.getByLabelText('Category') as HTMLSelectElement
    expect(category.value).toBe('general_contractors')
    expect(within(category).getByRole('group', { name: "Asher Construction's customers" })).toBeTruthy()

    await search(user)
    expect(calls.find((c) => c.path.endsWith('/api/search'))!.body).toMatchObject({ category: 'general_contractors' })
    expect(calls.some((c) => c.path.endsWith('/api/audit'))).toBe(false)
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Summit Construction', 'Ridge Homes', 'Peak Builders'])
    expect(screen.queryByText('Min score')).toBeNull()
    expect(screen.queryByText('No website')).toBeNull()
    expect(screen.getByText('No contact details listed')).toBeTruthy()
  })

  it("writes the pitch as Asher Construction and sends the offer to the AI", async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    await search(user)
    await user.click(screen.getByText('Summit Construction'))
    expect(await screen.findByText('Pitch from Asher Construction')).toBeTruthy()
    expect(screen.queryByText('Gaps found')).toBeNull()
    expect(screen.queryByText(/Est. deal value/)).toBeNull()
    expect(screen.getByText(/We do drywall, metal framing and acoustic ceilings/)).toBeTruthy()
    expect(screen.getByText("Add Asher Construction's details so pitches are signed and CAN-SPAM-compliant")).toBeTruthy()
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/api/pitch'))).toBe(true))
    const pitchBody = calls.find((c) => c.path.endsWith('/api/pitch'))!.body
    expect(pitchBody.offer).toEqual({ services: 'drywall, metal framing and acoustic ceilings', sellingPoints: '' })
    expect(pitchBody.sender.business).toBe('Asher Construction')
  })

  it('keeps saved leads separate per profile and remembers the active profile', async () => {
    stubApi()
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    await search(user)
    await user.click(screen.getByText('Ridge Homes'))
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: /Saved \(1\)/ })).toBeTruthy()
    expect(Object.keys(JSON.parse(window.localStorage.getItem('leadfinder:saved:asher-construction')!))).toEqual([RIDGE.id])
    expect(window.localStorage.getItem('leadfinder:saved')).toBeNull()

    await user.selectOptions(profileSelect(), '')
    expect(screen.getByRole('button', { name: /Saved \(0\)/ })).toBeTruthy()
    await user.selectOptions(profileSelect(), 'asher-construction')
    expect(screen.getByRole('button', { name: /Saved \(1\)/ })).toBeTruthy()

    unmount()
    render(<App />)
    expect(profileSelect().value).toBe('asher-construction')
  })

  it("edits Asher's details, which sign the pitch", async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    await user.click(screen.getByRole('button', { name: /Profile details/ }))
    const dialog = screen.getByRole('dialog', { name: 'Asher Construction profile' })
    expect((within(dialog).getByLabelText('What they do') as HTMLInputElement).value).toBe('drywall, metal framing and acoustic ceilings')
    expect((within(dialog).getByLabelText('General contractors & builders') as HTMLInputElement).checked).toBe(true)
    await user.type(within(dialog).getByLabelText('Name to sign with'), 'Asher')
    await user.type(within(dialog).getByLabelText('Selling points (optional, only true facts)'), 'Licensed and insured.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    const stored = JSON.parse(window.localStorage.getItem('leadfinder:profiles')!)
    expect(stored[0]).toMatchObject({ id: 'asher-construction', sellingPoints: 'Licensed and insured.', sender: { name: 'Asher', business: 'Asher Construction' } })
    expect(window.localStorage.getItem('leadfinder:sender')).toBeNull()

    await search(user)
    await user.click(screen.getByText('Summit Construction'))
    expect(await screen.findByText(/I'm Asher with Asher Construction/)).toBeTruthy()
    expect(screen.getByText(/Licensed and insured\./)).toBeTruthy()
  })

  it('creates a new client profile and requires a name and a customer type', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), '__new')
    const dialog = screen.getByRole('dialog', { name: 'New client profile' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert').textContent).toBe('Give the profile a name.')
    await user.type(within(dialog).getByLabelText('Profile name'), 'Bright Roofing')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert').textContent).toBe('Pick at least one kind of customer to search for.')
    await user.click(within(dialog).getByLabelText('Property managers'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(profileSelect().value).toBe('bright-roofing')
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('property_managers')
    expect(JSON.parse(window.localStorage.getItem('leadfinder:profiles')!).map((p: { id: string }) => p.id)).toEqual(['asher-construction', 'bright-roofing'])
  })

  it('deletes a profile and its saved leads after a confirmation', async () => {
    stubApi()
    window.localStorage.setItem('leadfinder:saved:asher-construction', JSON.stringify({ x: {} }))
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(profileSelect(), 'asher-construction')
    await user.click(screen.getByRole('button', { name: /Profile details/ }))
    await user.click(screen.getByRole('button', { name: 'Delete profile' }))
    await user.click(screen.getByRole('button', { name: 'Delete profile and its saved leads' }))
    expect(profileSelect().value).toBe('')
    expect(within(profileSelect()).queryByRole('option', { name: 'Asher Construction' })).toBeNull()
    expect(window.localStorage.getItem('leadfinder:saved:asher-construction')).toBeNull()
    expect(JSON.parse(window.localStorage.getItem('leadfinder:profiles')!)).toEqual([])
  })
})
