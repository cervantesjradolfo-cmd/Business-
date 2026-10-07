// Active projects from city building-permit open data (Chicago for now). A permit names the general
// contractor running the job, which is who hires subcontractors, so each permit becomes a lead.
import { distanceKm } from '../src/lib/geo.js'
import type { Lead, Project, ProjectsRequest, ProjectsResponse } from '../src/lib/types.js'
import { fetchWithTimeout } from './http.js'
import { geocode } from './osm.js'

const CHICAGO = {
  name: 'Chicago',
  center: { lat: 41.8781, lon: -87.6298 },
  coversKm: 30, // searches centred further away than this are outside the city
  dataset: 'https://data.cityofchicago.org/resource/ydr8-5enu.json',
}

// Permits that are only one trade's work: their descriptions mention ceilings (fans, lights) or
// framing (fences, porches) without any drywall or interior work.
const TRADE_ONLY = [
  'Electrical Work', 'Small-Scale Solar PV System', 'Fence or Trash Enclosure', 'Reroofing', 'Masonry Work',
  'Plumbing Work', 'Mechanical Work', 'Fire Alarm System', 'Scaffolding', 'Communication Equipment',
  'Small Temporary Structure', 'Storm Water Management Plan', 'Construction Trailer', 'Exterior Windows/Doors Replacement',
  'Porch,Deck,Balcony,or Fire Escape', 'Detached Frame Garage', 'Administrative Change',
]

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Keywords are validated to [A-Z0-9 /-] before they get here, so they are safe inside SoQL quotes.
export function buildPermitQuery(req: Pick<ProjectsRequest, 'keywords' | 'days' | 'radiusKm' | 'limit'>, center: { lat: number; lon: number }, now: Date): URLSearchParams {
  const since = new Date(now.getTime() - req.days * 86400000).toISOString().slice(0, 10)
  const words = req.keywords.map((k) => `upper(work_description) like '%${k}%'`).join(' OR ')
  const skip = TRADE_ONLY.map((t) => `'${t}'`).join(',')
  return new URLSearchParams({
    $where: [
      `issue_date >= '${since}T00:00:00'`,
      `within_circle(location, ${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}, ${Math.round(req.radiusKm * 1000)})`,
      `(work_type IS NULL OR work_type NOT IN (${skip}))`,
      `(${words})`,
    ].join(' AND '),
    $order: 'issue_date DESC',
    $limit: String(Math.min(req.limit * 2, 400)), // some rows have no contractor and are dropped
  })
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Llc|Lp|Pc)\b/g, (w) => w.toUpperCase())

// "SELF CERT 2019 CBC: INTERIOR ALTERATIONS TO ..." -> "Interior alterations to ..."
export function cleanDescription(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim().replace(/^(?:[A-Z0-9 &/.,'-]{2,40}:\s*)+/, '')
  const lower = s.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function contacts(row: Row): { type: string; name: string }[] {
  const out: { type: string; name: string }[] = []
  for (let i = 1; i <= 15; i++) {
    const type = str(row[`contact_${i}_type`]).toUpperCase()
    const name = str(row[`contact_${i}_name`])
    if (type && name) out.push({ type, name })
  }
  return out
}

// Only the general contractor and the architect of record are kept, both named on the permit in
// their professional role. Owners can be private people, so their names are never shown.
export function permitToLead(row: Row, center: { lat: number; lon: number }): Lead | null {
  const permit = str(row.permit_)
  const lat = Number(row.latitude)
  const lon = Number(row.longitude)
  const gc = contacts(row).find((c) => c.type.includes('GENERAL CONTRACTOR'))
  if (!permit || !gc || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const architect = contacts(row).find((c) => c.type.includes('ARCHITECT'))
  const address = titleCase([str(row.street_number), str(row.street_direction), str(row.street_name)].filter(Boolean).join(' '))
  const cost = Number(row.reported_cost)
  const project: Project = {
    permit,
    city: CHICAGO.name,
    issued: str(row.issue_date).slice(0, 10),
    description: cleanDescription(str(row.work_description)),
    address,
    ...(str(row.work_type) ? { workType: str(row.work_type) } : {}),
    ...(Number.isFinite(cost) && cost > 0 ? { cost: Math.round(cost) } : {}),
    ...(architect ? { architect: titleCase(architect.name) } : {}),
  }
  return {
    id: `permit:chicago/${permit}`,
    osmType: 'node',
    osmId: 0,
    osmUrl: '',
    name: titleCase(gc.name),
    category: 'General contractor',
    categoryId: 'general_contractors',
    address: `${address}, ${CHICAGO.name}`,
    city: CHICAGO.name,
    lat,
    lon,
    distanceKm: Math.round(distanceKm(center, { lat, lon }) * 100) / 100,
    project,
  }
}

export async function searchProjects(req: ProjectsRequest, now = new Date()): Promise<ProjectsResponse | { error: string; status: number }> {
  let center
  try {
    center = await geocode(req.location)
  } catch (err) {
    console.error('projects geocode error', err)
    return { error: 'Location lookup failed. Please try again.', status: 502 }
  }
  if (!center) return { error: "Couldn't find that location. Try a city name or ZIP code.", status: 404 }
  if (distanceKm(center, CHICAGO.center) > CHICAGO.coversKm) {
    return { center, leads: [], notice: 'Project search uses city building permits and covers Chicago only for now.' }
  }
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (process.env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN
    const res = await fetchWithTimeout(`${CHICAGO.dataset}?${buildPermitQuery(req, center, now)}`, { headers, timeoutMs: 20000 })
    if (!res.ok) throw new Error(`Permits HTTP ${res.status}`)
    const rows = (await res.json()) as unknown
    const leads = (Array.isArray(rows) ? rows : [])
      .map((r) => (r && typeof r === 'object' ? permitToLead(r as Row, center) : null))
      .filter((l): l is Lead => !!l)
      .slice(0, req.limit)
    return { center, leads }
  } catch (err) {
    console.error('permits error', err)
    return { error: "The city's permit data didn't answer. Please try again in a minute.", status: 502 }
  }
}
