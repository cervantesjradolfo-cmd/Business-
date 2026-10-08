import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Loader2, Search } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { KM_PER_MILE } from '../lib/format'
import type { CategoryId, ClientProfile, ProjectsRequest, SearchRequest } from '../lib/types'

type Props = {
  onSearch: (req: SearchRequest) => void
  onSearchProjects: (req: ProjectsRequest) => void
  searching: boolean
  demo: boolean
  profile?: ClientProfile
}

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand'
const DAYS = [30, 60, 90, 180]

export default function SearchForm({ onSearch, onSearchProjects, searching, demo, profile }: Props) {
  // Profiles with permit keywords can also search active projects, and start there.
  const canProjects = !!profile && profile.projectKeywords.length > 0
  const [kind, setKind] = useState<'projects' | 'businesses'>(canProjects ? 'projects' : 'businesses')
  const projects = canProjects && kind === 'projects'
  const [days, setDays] = useState(60)
  const [location, setLocation] = useState('')
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
    if (disabled || !location.trim()) return
    const n = Math.min(200, Math.max(1, Number.isFinite(limit) ? Math.round(limit) : 60))
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block lg:flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Location</span>
          <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, ZIP code or address" maxLength={200} required />
        </label>
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
          <span className="mb-1 block text-xs font-medium text-slate-600">Max results</span>
          <input type="number" min={1} max={200} className={field} value={Number.isFinite(limit) ? limit : ''} onChange={(e) => setLimit(e.target.value === '' ? NaN : Number(e.target.value))} />
        </label>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Search
        </button>
      </div>
      {demo && <p className="mt-2 text-xs text-amber-700">Exit demo to search</p>}
    </form>
  )
}
