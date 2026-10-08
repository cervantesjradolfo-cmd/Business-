import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { AuditResult, Lead, Pitch } from './lib/types'

const mk = (n: number, p: Partial<Lead>): Lead => ({
  id: `osm:node/${n}`, osmType: 'node', osmId: n, osmUrl: `https://www.openstreetmap.org/node/${n}`,
  name: `Biz ${n}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 1, lon: 1, distanceKm: n, ...p,
})
const ALPHA = mk(1, { name: 'Alpha Cafe', phone: '+1 555-0001' })
const BETA = mk(2, { name: 'Beta Bakery' })
const GAMMA = mk(3, { name: 'Gamma Grill', phone: '+1 555-0003', openingHours: 'Mo-Su 09:00-17:00', website: 'https://gamma.example.com' })
const GAMMA_AUDIT: AuditResult = { id: GAMMA.id, status: 'ok', gaps: [], checkedAt: '2026-01-01T00:00:00Z' }

type Opts = { search?: () => Response; leads?: Lead[]; notice?: string; pitch?: () => Response }
const jsonRes = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

let calls: { path: string; body: any }[]
function stubApi(o: Opts = {}) {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/search')) {
      return o.search ? o.search() : jsonRes({ center: { lat: 1, lon: 1, displayName: 'X' }, leads: o.leads ?? [ALPHA, BETA, GAMMA], source: 'overpass', notice: o.notice })
    }
    if (url.endsWith('/api/audit')) return jsonRes({ results: [GAMMA_AUDIT] })
    if (url.endsWith('/api/pitch')) {
      if (o.pitch) return o.pitch()
      throw new Error('pitch down')
    }
    return new Response('nope', { status: 500 })
  }))
}

async function search(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Location'), 'Austin')
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('first run and search flow', () => {
  it('shows the first-run empty state and the OSM footer link', () => {
    stubApi()
    render(<App />)
    expect(screen.getByText('Search a town and category to find leads')).toBeTruthy()
    const link = screen.getByRole('link', { name: /OpenStreetMap contributors/ })
    expect(link.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright')
  })

  it('does not search with a blank location', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Location'), '   ')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(calls.length).toBe(0)
  })

  it('lists sorted results, audits only leads with a website, and shows the count', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Alpha Cafe')
    await waitFor(() => expect(screen.getByRole('button', { name: /Results \(3\)/ })).toBeTruthy())
    const auditCalls = calls.filter((c) => c.path.endsWith('/api/audit'))
    expect(auditCalls.length).toBe(1)
    expect(auditCalls[0].body.leads).toEqual([{ id: GAMMA.id, website: GAMMA.website }])
    const searchBody = calls.find((c) => c.path.endsWith('/api/search'))!.body
    // The slider shows miles (3 mi default) and the API gets km.
    expect(screen.getByText('Radius: 3 mi')).toBeTruthy()
    expect(searchBody).toMatchObject({ location: 'Austin', category: 'any', radiusKm: 4.83, limit: 60 })
    expect(screen.getAllByText('0.6 mi').length).toBeGreaterThan(0) // Alpha Cafe, 1 km away
    // Beta (score 80) before Alpha (74) before Gamma (0)
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Beta Bakery', 'Alpha Cafe', 'Gamma Grill'])
    expect(screen.getByText('Showing 3 of 3')).toBeTruthy()
  })

  it('shows the fallback notice above the list', async () => {
    stubApi({ notice: 'Map servers were busy, so results came from a simpler search and may be incomplete.' })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    expect(await screen.findByText(/Map servers were busy/)).toBeTruthy()
  })

  it('shows the empty state when zero businesses are found', async () => {
    stubApi({ leads: [] })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    expect(await screen.findByText("No businesses found. Try a bigger radius or 'Any business'.")).toBeTruthy()
  })

  it('shows the server error message (not the demo offer) for a JSON 404', async () => {
    stubApi({ search: () => jsonRes({ error: "Couldn't find that location. Try a city name or ZIP code." }, 404) })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    expect(await screen.findByText(/Couldn't find that location/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Explore demo data' })).toBeNull()
  })
})

describe('chains', () => {
  const CHAIN_A = mk(10, { name: 'Starbucks', brand: 'Starbucks', isChain: true })
  const CHAIN_B = mk(11, { name: 'Starbucks', brandWikidata: 'Q37158', isChain: true, distanceKm: 11 })

  it('hides chains by default and shows them with the Show chains filter', async () => {
    stubApi({ leads: [ALPHA, CHAIN_A, CHAIN_B] })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Alpha Cafe')
    expect(screen.queryByText('Starbucks')).toBeNull()
    expect(screen.getByText('Showing 1 of 3')).toBeTruthy()
    const toggle = screen.getByRole('checkbox', { name: /Show chains \(2\)/ })
    await user.click(toggle)
    expect(screen.getAllByText('Starbucks')).toHaveLength(2)
    expect(screen.getAllByText('Chain / franchise')).toHaveLength(2)
    expect(screen.getByText('Showing 3 of 3')).toBeTruthy()
    await user.click(toggle)
    expect(screen.queryByText('Starbucks')).toBeNull()
  })

  it('does not show the chains filter when there are no chains', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Alpha Cafe')
    expect(screen.queryByRole('checkbox', { name: /Show chains/ })).toBeNull()
  })
})

describe('API unavailable and demo mode', () => {
  it('offers demo data when the API is unreachable, then shows banner and disables Search', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })))
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    expect(await screen.findByText(/server isn't reachable from here/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Explore demo data' }))
    expect(screen.getByText('DEMO DATA: fictional businesses, not real leads.')).toBeTruthy()
    expect(screen.getByText('Fakeville Family Dental')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Exit demo to search')).toBeTruthy()
    expect(screen.getByText('Showing 12 of 12')).toBeTruthy()
    // alert is gone once demo is loaded
    expect(screen.queryByText(/server isn't reachable/)).toBeNull()
  })

  it('treats a rejected fetch as unavailable too, and Exit demo returns to idle', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByRole('button', { name: 'Explore demo data' }))
    await user.click(screen.getByRole('button', { name: 'Exit demo' }))
    expect(screen.queryByText(/DEMO DATA/)).toBeNull()
    expect(screen.getByText('Search a town and category to find leads')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('demo leads never call the network for pitches', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('offline') })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByRole('button', { name: 'Explore demo data' }))
    const before = fetchMock.mock.calls.length
    await user.click(screen.getByText('Fakeville Family Dental'))
    expect(screen.getByRole('heading', { level: 2, name: 'Fakeville Family Dental' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Regenerate' }))
    expect(fetchMock.mock.calls.length).toBe(before)
    expect(screen.getByText('Template')).toBeTruthy()
  })
})

describe('filters', () => {
  async function demo(user: ReturnType<typeof userEvent.setup>) {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    render(<App />)
    await search(user)
    await user.click(await screen.findByRole('button', { name: 'Explore demo data' }))
  }

  it('"No website only" and "Has phone" narrow the list and update the count', async () => {
    const user = userEvent.setup()
    await demo(user)
    await user.click(screen.getByLabelText('No website only'))
    // demo leads 1, 2, 7 have no website
    expect(screen.getByText('Showing 3 of 12')).toBeTruthy()
    expect(screen.queryByText('Demo Beans Cafe')).toBeNull()
    await user.click(screen.getByLabelText('Has phone'))
    expect(screen.getByText('Showing 3 of 12')).toBeTruthy() // all three have phones
    await user.click(screen.getByLabelText('No website only'))
    expect(screen.getByText('Showing 11 of 12')).toBeTruthy() // only demo:4 lacks a phone
    expect(screen.queryByText('Example Auto Works')).toBeNull()
  })

  it('min score hides low-scoring leads and shows a no-match state when too high', async () => {
    const user = userEvent.setup()
    await demo(user)
    const slider = screen.getByLabelText(/Min score/) as HTMLInputElement
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(slider, { target: { value: '100' } })
    expect(screen.getByText('Showing 0 of 12')).toBeTruthy()
    expect(screen.getByText('No leads match these filters')).toBeTruthy()
    fireEvent.change(slider, { target: { value: '0' } })
    expect(screen.getByText('Showing 12 of 12')).toBeTruthy()
  })
})

describe('lead detail, pitch and copy', () => {
  it('shows contact rows, "Not listed", gaps, services and deal value', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Beta Bakery'))
    const detail = screen.getByRole('heading', { level: 2, name: 'Beta Bakery' }).closest('div.space-y-4') as HTMLElement
    expect(within(detail).getAllByText('Not listed').length).toBeGreaterThanOrEqual(4)
    expect(within(detail).getByText('No website')).toBeTruthy()
    expect(within(detail).getByText(/Est\. deal value \$/)).toBeTruthy()
    expect(within(detail).getByRole('link', { name: 'Google Maps' }).getAttribute('href')).toContain('google.com/maps')
    expect(within(detail).getByRole('link', { name: 'OpenStreetMap' }).getAttribute('href')).toBe(BETA.osmUrl)
  })

  it('renders hostile business names as text, not HTML', async () => {
    stubApi({ leads: [mk(9, { name: '<img src=x onerror=alert(1)> & Sons' })] })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('<img src=x onerror=alert(1)> & Sons')
    expect(document.querySelector('img')).toBeNull()
  })

  it('switches pitch tabs and copies the email with its subject; shows Copied then reverts after 2 s', async () => {
    stubApi()
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    expect(screen.getByText('Quick idea for Alpha Cafe')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(copied.startsWith('Subject: Quick idea for Alpha Cafe\n\nHi Alpha Cafe team,')).toBe(true)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Text' }))
    expect(screen.queryByText(/^Subject:/)).toBeNull()
    expect(screen.getByText(/Reply STOP to opt out\.$/)).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Call' }))
    expect(screen.getByText(/Do you have two minutes\?/)).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy(), { timeout: 3000 })
  })

  it('shows "Press Ctrl/Cmd+C to copy" when copying fails', async () => {
    stubApi()
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('denied') }) }, configurable: true })
    ;(document as any).execCommand = vi.fn(() => false)
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Press Ctrl/Cmd+C to copy')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
  })

  it('uses an AI pitch from the server when available and falls back to Template silently otherwise', async () => {
    const aiPitch: Pitch = {
      email: { subject: 'AI subject for Alpha Cafe', body: 'Hello Alpha Cafe' },
      sms: 'sms Alpha Cafe', phoneOpener: 'open Alpha Cafe', source: 'ai',
    }
    stubApi({ pitch: () => jsonRes(aiPitch) })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    expect(await screen.findByText('AI subject for Alpha Cafe')).toBeTruthy()
    expect(screen.getByText('Written by AI')).toBeTruthy()
  })

  it('falls back to the template when /api/pitch fails', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/api/pitch'))).toBe(true))
    expect(screen.getByText('Template')).toBeTruthy()
    expect(screen.getByText('Quick idea for Alpha Cafe')).toBeTruthy()
  })

  it('shows the add-details hint, opens the modal, and Esc closes it', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    await user.click(screen.getByText(/Add your details so pitches are signed/))
    expect(screen.getByRole('dialog', { name: 'Your details' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    // the lead detail stays open after closing the modal with Esc
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Cafe' })).toBeTruthy()
  })

  it('saving details hides the hint and signs the pitch', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    await user.click(screen.getByRole('button', { name: 'Your details' }))
    await user.type(screen.getByLabelText('Your name'), 'Jo Smith')
    await user.type(screen.getByLabelText('Your business'), 'Jo Web Co')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(screen.queryByText(/Add your details so pitches are signed/)).toBeNull()
    expect(screen.getByText(/Jo Smith/)).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem('leadfinder:sender')!).name).toBe('Jo Smith')
  })

  it('Esc closes the detail panel', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Cafe' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { level: 2, name: 'Alpha Cafe' })).toBeNull()
  })
})

describe('saved leads and status (localStorage)', () => {
  it('saves a lead, changes status and notes, persists, and survives a new search and a reload', async () => {
    stubApi()
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await search(user)
    await user.click(await screen.findByText('Alpha Cafe'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Saved (1)' })).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Status'), 'contacted')
    await user.type(screen.getByLabelText('Notes'), 'Called')
    const stored = JSON.parse(window.localStorage.getItem('leadfinder:saved')!)
    expect(stored[ALPHA.id].status).toBe('contacted')
    expect(stored[ALPHA.id].notes).toBe('Called')
    // status pill on the card
    expect(within(screen.getByRole('heading', { level: 3, name: 'Alpha Cafe' }).closest('button') as HTMLElement).getByText('Contacted')).toBeTruthy()

    // new search that returns different leads: saved list still has Alpha
    stubApi({ leads: [BETA] })
    await user.click(screen.getByRole('button', { name: /Results/ }))
    await user.type(screen.getByLabelText('Location'), ' again')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('Beta Bakery')
    expect(screen.queryByText('Alpha Cafe')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Saved \(1\)/ }))
    expect(screen.getByRole('heading', { level: 3, name: 'Alpha Cafe' })).toBeTruthy()

    // reload
    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Saved \(1\)/ }))
    expect(screen.getByRole('heading', { level: 3, name: 'Alpha Cafe' })).toBeTruthy()
  })

  it('changing the status of an unsaved lead auto-saves it; Remove deletes it', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await user.click(await screen.findByText('Beta Bakery'))
    await user.selectOptions(screen.getByLabelText('Status'), 'won')
    expect(screen.getByRole('button', { name: 'Saved (1)' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('button', { name: 'Saved (0)' })).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)).toEqual({})
  })

  it('shows the no-saved-leads empty state', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Saved/ }))
    expect(screen.getByText('No saved leads yet')).toBeTruthy()
  })

  it('does not crash on corrupt localStorage', () => {
    window.localStorage.setItem('leadfinder:saved', '{not json')
    window.localStorage.setItem('leadfinder:sender', '[[[')
    stubApi()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Saved (0)' })).toBeTruthy()
  })

  it('drops saved entries with a bad shape but keeps valid ones', () => {
    window.localStorage.setItem('leadfinder:saved', JSON.stringify({
      bad: { lead: { id: 5 } }, worse: null,
      good: { lead: { ...ALPHA }, status: 'replied', notes: 'n' },
    }))
    stubApi()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Saved (1)' })).toBeTruthy()
  })
})

describe('CSV export', () => {
  it('is disabled with nothing to export', () => {
    stubApi()
    render(<App />)
    expect((screen.getByRole('button', { name: /Export CSV/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('downloads only the filtered list with a dated filename, BOM and CRLF', async () => {
    stubApi()
    let blob: Blob | undefined
    ;(URL as any).createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x' })
    ;(URL as any).revokeObjectURL = vi.fn()
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download) })
    const user = userEvent.setup()
    render(<App />)
    await search(user)
    await screen.findByText('Alpha Cafe')
    await user.click(screen.getByLabelText('No website only'))
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))
    expect(clicked.length).toBe(1)
    expect(clicked[0]).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/)
    const bytes = new Uint8Array(await new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(blob!) }))
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
    expect(text).toContain('\r\n')
    expect(text).toContain('"Alpha Cafe"')
    expect(text).toContain('"Beta Bakery"')
    expect(text).not.toContain('Gamma Grill')
  })
})
