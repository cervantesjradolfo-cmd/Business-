import { useState, type FormEvent } from 'react'
import { Loader2, Search } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import type { CategoryId, SearchRequest } from '../lib/types'

type Props = { onSearch: (req: SearchRequest) => void; searching: boolean; demo: boolean }

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand'

export default function SearchForm({ onSearch, searching, demo }: Props) {
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState<CategoryId>('any')
  const [radiusKm, setRadiusKm] = useState(5)
  const [limit, setLimit] = useState(60)
  const disabled = searching || demo

  function submit(e: FormEvent) {
    e.preventDefault()
    if (disabled || !location.trim()) return
    const n = Number.isFinite(limit) ? Math.round(limit) : 60
    onSearch({ location: location.trim(), category, radiusKm, limit: Math.min(200, Math.max(1, n)) })
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block lg:flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Location</span>
          <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, ZIP code or address" maxLength={200} required />
        </label>
        <label className="block lg:w-56">
          <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="block lg:w-44">
          <span className="mb-1 block text-xs font-medium text-slate-600">Radius: {radiusKm} km</span>
          <input type="range" min={1} max={25} step={1} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="h-9 w-full accent-brand" />
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
