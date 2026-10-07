import clsx from 'clsx'
import { Download, Settings, Target } from 'lucide-react'
import type { ClientProfile } from '../lib/types'

// Select value that starts a new client profile instead of switching to one.
export const NEW_PROFILE = '__new'

type Props = {
  tab: 'results' | 'saved'
  onTab: (t: 'results' | 'saved') => void
  resultsCount: number
  savedCount: number
  canExport: boolean
  onExport: () => void
  onSettings: () => void
  profiles: ClientProfile[]
  activeId: string // '' = your agency
  onSelectProfile: (id: string) => void
}

export default function Header({ tab, onTab, resultsCount, savedCount, canExport, onExport, onSettings, profiles, activeId, onSelectProfile }: Props) {
  const tabCls = (active: boolean) =>
    clsx(
      'rounded-lg px-3 py-1.5 text-sm font-medium',
      active ? 'bg-indigo-50 text-brand' : 'text-slate-600 hover:bg-slate-100',
    )
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white"><Target className="h-5 w-5" aria-hidden /></span>
          <span className="text-lg font-bold tracking-tight">Lead Finder</span>
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-600">Finding leads for</span>
          <select
            value={activeId} onChange={(e) => onSelectProfile(e.target.value)}
            className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium focus:border-brand"
          >
            <option value="">My agency</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value={NEW_PROFILE}>+ New client profile…</option>
          </select>
        </label>
        <nav className="flex gap-1" aria-label="Lists">
          <button type="button" className={tabCls(tab === 'results')} aria-current={tab === 'results'} onClick={() => onTab('results')}>Results ({resultsCount})</button>
          <button type="button" className={tabCls(tab === 'saved')} aria-current={tab === 'saved'} onClick={() => onTab('saved')}>Saved ({savedCount})</button>
        </nav>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onExport} disabled={!canExport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden />Export CSV
          </button>
          <button type="button" onClick={onSettings} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            <Settings className="h-4 w-4" aria-hidden />{activeId ? 'Profile details' : 'Your details'}
          </button>
        </div>
      </div>
    </header>
  )
}
