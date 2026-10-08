import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Loader2, Search } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { LARGEST_US_CITIES, MAX_PLACES, STATE_CITIES, parsePlaces, stateCities } from '../data/places'
import { KM_PER_MILE } from '../lib/format'
import type { CategoryId, ClientProfile, ProjectsRequest, SearchRequest } from '../lib/types'

type Props = {
  onSearch: (req: SearchRequest) => void
  onSearchProjects: (req: ProjectsRequest) => void
  onSearchPlaces: (places: string[], base: Omit<SearchRequest, 'location'>) => void
  searching: boolean
  demo: boolean
  profile?: ClientProfile
}

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand'
const DAYS = [30, 60, 90, 180]

export default function SearchForm({ onSearch, onSearchProjects, onSearchPlaces, searching, demo, profile }: Props) {
  // Profiles with permit keywords can also search active projects, and start there.
  const canProjects = !!profile && profile.projectKeywords.length > 0
  const [kind, setKind] = useState<'projects' | 'businesses'>(canProjects ? 'projects' : 'businesses')
  const projects = canProjects && kind === 'projects'
  const [days, setDays] = useState(60)
  const [location, setLocation] = useState('')
  // Business searches can run over many places, one after another (projects are Chicago only).
  const [where, setWhere] = useState<'one' | 'many'>('one')
  const [placesText, setPlacesText] = useState('')
  const many = !projects && where === 'many'
  const places = parsePlaces(placesText)
  const [category, setCategory] = useState<CategoryId>(profile?.categories[0] ?? 'any')
  // A client profile lists its customer types first.
  const preferred = CATEGORIES.filter((c) => profile?.categories.includes(c.id))
  const others = CATEGORIES.filter((c) => !profile?.categories.includes(c.id))
  // Shown in miles; the API takes km (15 mi is just under its 25 km cap).
  const [radiusMi, setRadiusMi] = useState(3)
  const radiusKm = Math.round(radiusMi * KM_PER_MILE * 100) / 100
  const [limit, setLimit] = useState(60)
  const disabled = searching || demo

  function submit(e: FormEvent) {
    e.preventDefault()
    if (disabled) return
    const n = Math.min(200, Math.max(1, Number.isFinite(limit) ? Math.round(limit) : 60))
    if (many) {
      if (places.length > 0) onSearchPlaces(places, { category, radiusKm, limit: n })
      return
    }
    if (!location.trim()) return
    if (projects) onSearchProjects({ location: location.trim(), radiusKm, keywords: profile!.projectKeywords, days, limit: n })
    else onSearch({ location: location.trim(), category, radiusKm, limit: n })
  }

  const kindBtn = (active: boolean) =>
    clsx('rounded-lg px-3 py-1 text-sm font-medium', active ? 'bg-indigo-50 text-brand' : 'text-slate-600 hover:bg-slate-100')
  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {canProjects && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div role="group" aria-label="Look for" className="flex gap-1">
            <button type="button" aria-pressed={projects} onClick={() => setKind('projects')} className={kindBtn(projects)}>Active projects</button>
            <button type="button" aria-pressed={!projects} onClick={() => setKind('businesses')} className={kindBtn(!projects)}>Businesses</button>
          </div>
          <p className="text-xs text-slate-500">
            {projects
              ? `Recent building permits for ${profile!.label}'s kind of work, with the general contractor running each job. Chicago only for now.`
              : `Businesses that could hire ${profile!.label}, from OpenStreetMap.`}
          </p>
        </div>
      )}
      {!projects && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div role="group" aria-label="Where" className="flex gap-1">
            <button type="button" aria-pressed={!many} onClick={() => setWhere('one')} className={kindBtn(!many)}>One place</button>
            <button type="button" aria-pressed={many} onClick={() => setWhere('many')} className={kindBtn(many)}>Many places</button>
          </div>
          {many && <p className="text-xs text-slate-500">Searches each place in turn and adds the results to one list.</p>}
        </div>
      )}
      {many && (
        <div className="mb-3 space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Places, one per line ({places.length} of up to {MAX_PLACES})</span>
            <textarea className={field} rows={5} value={placesText} onChange={(e) => setPlacesText(e.target.value)} placeholder={'Austin, TX\nDenver, CO\n60614'} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="whitespace-nowrap text-slate-600">Fill with</span>
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand" value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v) setPlacesText((v === 'largest' ? LARGEST_US_CITIES : stateCities(v)).join('\n'))
                }}
              >
                <option value="">Choose a list…</option>
                <option value="largest">Largest US cities ({LARGEST_US_CITIES.length})</option>
                {STATE_CITIES.map((s) => <option key={s.code} value={s.code}>{s.name}: biggest cities</option>)}
              </select>
            </label>
            {placesText && <button type="button" onClick={() => setPlacesText('')} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">Clear</button>}
          </div>
          <p className="text-xs text-slate-500">Each place takes about 5 to 30 seconds, so 50 places can take 10 to 20 minutes. Keep this tab open; you can stop at any time and keep what was found.</p>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {!many && (
          <label className="block lg:flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Location</span>
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, ZIP code or address" maxLength={200} required />
          </label>
        )}
        {projects ? (
          <label className="block lg:w-64">
            <span className="mb-1 block text-xs font-medium text-slate-600">Permit issued in the last</span>
            <select className={field} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        ) : (
          <label className="block lg:w-64">
            <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
              {preferred.length > 0 ? (
                <>
                  <optgroup label={`${profile!.label}'s customers`}>
                    {preferred.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="All categories">
                    {others.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                </>
              ) : (
                others.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)
              )}
            </select>
          </label>
        )}
        <label className="block lg:w-44">
          <span className="mb-1 block text-xs font-medium text-slate-600">Radius: {radiusMi} mi</span>
          <input type="range" min={1} max={15} step={1} value={radiusMi} onChange={(e) => setRadiusMi(Number(e.target.value))} className="h-9 w-full accent-brand" />
        </label>
        <label className="block lg:w-24">
          <span className="mb-1 block text-xs font-medium text-slate-600">{many ? 'Max per place' : 'Max results'}</span>
          <input type="number" min={1} max={200} className={field} value={Number.isFinite(limit) ? limit : ''} onChange={(e) => setLimit(e.target.value === '' ? NaN : Number(e.target.value))} />
        </label>
        <button
          type="submit"
          disabled={disabled || (many && places.length === 0)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          {many ? `Search ${places.length} ${places.length === 1 ? 'place' : 'places'}` : 'Search'}
        </button>
      </div>
      {demo && <p className="mt-2 text-xs text-amber-700">Exit demo to search</p>}
    </form>
  )
}
