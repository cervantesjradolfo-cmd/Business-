// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPermitQuery, cleanDescription, permitToLead, searchProjects } from './permits'

const center = { lat: 41.8781, lon: -87.6298 }
const row = (over: Record<string, unknown> = {}) => ({
  permit_: 'B100', issue_date: '2026-10-06T00:00:00.000', street_number: '225', street_direction: 'W', street_name: 'RANDOLPH ST',
  work_type: null, reported_cost: '44919084', latitude: '41.8846', longitude: '-87.6340',
  work_description: 'SELF CERT 2019 CBC: INTERIOR ALTERATIONS TO EXISTING OFFICE FLOORS 10 THROUGH 16. NEW PARTITIONS AND CEILINGS.',
  contact_1_type: 'OWNER', contact_1_name: 'JANE PRIVATE',
  contact_2_type: 'CONTRACTOR-ELECTRICAL', contact_2_name: 'KELSO-BURNETT CO.',
  contact_3_type: 'CONTRACTOR-GENERAL CONTRACTOR', contact_3_name: 'REDMOND CONSTRUCTION CORP.',
  contact_4_type: 'SELF CERT ARCHITECT', contact_4_name: 'GENSLER ARCHITECTS LLC',
  ...over,
})

describe('buildPermitQuery', () => {
  it('filters by date, radius, keywords and leaves out trade-only permits', () => {
    const q = buildPermitQuery({ keywords: ['DRYWALL', 'BUILD-OUT'], days: 60, radiusKm: 15, limit: 50 }, center, new Date('2026-10-07T15:00:00Z'))
    const where = q.get('$where')!
    expect(where).toContain("issue_date >= '2026-08-08T00:00:00'")
    expect(where).toContain('within_circle(location, 41.87810, -87.62980, 15000)')
    expect(where).toContain("(upper(work_description) like '%DRYWALL%' OR upper(work_description) like '%BUILD-OUT%')")
    expect(where).toContain("work_type NOT IN ('Electrical Work',")
    expect(q.get('$order')).toBe('issue_date DESC')
    expect(q.get('$limit')).toBe('100')
  })
})

describe('permitToLead', () => {
  it('makes the general contractor the lead, with the job as its project', () => {
    const l = permitToLead(row(), center)!
    expect(l).toMatchObject({
      id: 'permit:chicago/B100', name: 'Redmond Construction Corp.', category: 'General contractor', categoryId: 'general_contractors',
      address: '225 W Randolph St, Chicago', city: 'Chicago', lat: 41.8846, lon: -87.634, osmUrl: '',
      project: {
        permit: 'B100', city: 'Chicago', issued: '2026-10-06', address: '225 W Randolph St', cost: 44919084,
        architect: 'Gensler Architects LLC',
        description: 'Interior alterations to existing office floors 10 through 16. new partitions and ceilings.',
      },
    })
    expect(l.distanceKm).toBeGreaterThan(0.5)
    expect(l.project).not.toHaveProperty('workType')
  })
  it('never carries owner names, and skips permits without a general contractor or location', () => {
    expect(JSON.stringify(permitToLead(row(), center))).not.toContain('JANE')
    expect(JSON.stringify(permitToLead(row(), center))).not.toMatch(/Jane/i)
    expect(permitToLead(row({ contact_3_type: 'EXPEDITOR' }), center)).toBeNull()
    expect(permitToLead(row({ latitude: undefined }), center)).toBeNull()
    expect(permitToLead(row({ contact_3_type: 'GENERAL CONTRACTOR' }), center)?.name).toBe('Redmond Construction Corp.')
  })
  it('cleans permit prefixes off descriptions', () => {
    expect(cleanDescription('DDS 2019 CBRC & CBC:  INTERIOR AND EXTERIOR ALTERATIONS')).toBe('Interior and exterior alterations')
    expect(cleanDescription('NEW CONSTRUCTION OF 3 STORY BUILDING')).toBe('New construction of 3 story building')
  })
})

describe('searchProjects', () => {
  let urls: string[]
  let permitHeaders: Record<string, string>
  function stub(permits: () => Response, geo = [{ lat: '41.88', lon: '-87.63', display_name: 'Chicago' }]) {
    urls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(String(url))
      if (String(url).includes('nominatim')) return new Response(JSON.stringify(geo), { status: 200 })
      permitHeaders = init?.headers as Record<string, string>
      return permits()
    }))
  }
  let n = 0
  const req = (over = {}) => ({ location: `Chicago ${++n}`, radiusKm: 10, keywords: ['DRYWALL'], days: 60, limit: 1, ...over })
  beforeEach(() => { delete process.env.SOCRATA_APP_TOKEN })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns project leads, capped at the limit, and sends the app token when set', async () => {
    process.env.SOCRATA_APP_TOKEN = 'tok'
    stub(() => new Response(JSON.stringify([row({ contact_3_type: 'OWNER' }), row(), row({ permit_: 'B101' })]), { status: 200 }))
    const r = await searchProjects(req())
    expect('leads' in r && r.leads.map((l) => l.id)).toEqual(['permit:chicago/B100'])
    expect(urls.some((u) => u.startsWith('https://data.cityofchicago.org/resource/ydr8-5enu.json?'))).toBe(true)
    expect(permitHeaders['X-App-Token']).toBe('tok')
  })
  it('says Chicago only, without asking the city, for a location elsewhere', async () => {
    stub(() => { throw new Error('should not be called') }, [{ lat: '39.74', lon: '-104.99', display_name: 'Denver' }])
    const r = await searchProjects(req({ location: 'Denver' }))
    expect(r).toMatchObject({ leads: [], notice: expect.stringContaining('Chicago only') })
    expect(urls.some((u) => u.includes('cityofchicago'))).toBe(false)
  })
  it('reports a friendly error when the permit data fails', async () => {
    stub(() => new Response('down', { status: 503 }))
    expect(await searchProjects(req())).toEqual({ error: "The city's permit data didn't answer. Please try again in a minute.", status: 502 })
  })
})
