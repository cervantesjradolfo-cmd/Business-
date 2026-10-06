import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SearchX, Target, Bookmark } from 'lucide-react'
import clsx from 'clsx'
import { DEMO_AUDITS, DEMO_LEADS } from './data/demo'
import { ApiUnavailableError, auditLeads, fetchPitch, searchLeads } from './lib/api'
import { browserOverpassSearch } from './lib/overpassBrowser'
import { csvFilename, leadsToCsv } from './lib/csv'
import { applyFilters, sortLeads } from './lib/filters'
import { toLead } from './lib/format'
import { buildTemplatePitch } from './lib/pitch'
import { scoreLead } from './lib/scoring'
import { useSavedLeads, useSender } from './lib/storage'
import type { AuditResult, Filters as FiltersState, Lead, Pitch, PitchRequest, ScoredLead, SearchRequest, Sender } from './lib/types'
import ApiNotice from './components/ApiNotice'
import DemoBanner from './components/DemoBanner'
import EmptyState from './components/EmptyState'
import Filters from './components/Filters'
import Header from './components/Header'
import LeadDetail from './components/LeadDetail'
import LeadList from './components/LeadList'
import ProgressBar from './components/ProgressBar'
import SearchNotice from './components/SearchNotice'
import SearchForm from './components/SearchForm'
import SenderSettings from './components/SenderSettings'

type Phase = 'idle' | 'searching' | 'auditing' | 'done' | 'error' | 'unavailable'

const BATCH = 8

function pitchRequest(l: ScoredLead, sender: Sender): PitchRequest {
  return {
    lead: { name: l.name, category: l.category, city: l.city, website: l.website },
    gaps: l.gaps.map((g) => g.id),
    services: l.services,
    sender,
  }
}

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [audits, setAudits] = useState<Record<string, AuditResult>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [notice, setNotice] = useState<string | undefined>()
  const [source, setSource] = useState<'overpass' | 'nominatim' | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  const [tab, setTab] = useState<'results' | 'saved'>('results')
  const [filters, setFilters] = useState<FiltersState>({ minScore: 0, noWebsiteOnly: false, hasPhone: false, showChains: false })
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pitches, setPitches] = useState<Record<string, Pitch>>({})
  const [pitchLoading, setPitchLoading] = useState(false)

  const { saved, save, remove, setStatus, setNotes, setPitch } = useSavedLeads()
  const [sender, setSender] = useSender()
  const runRef = useRef<AbortController | null>(null)
  const lastReqRef = useRef<SearchRequest | null>(null)
  const requested = useRef<Set<string>>(new Set())

  // ---- lists ----
  const resultScored = useMemo(() => leads.map((l) => scoreLead(l, audits[l.id], pending.has(l.id))), [leads, audits, pending])
  const savedScored = useMemo(() => Object.values(saved).map((s) => scoreLead(s.lead, s.audit)), [saved])
  const allScored = tab === 'results' ? resultScored : savedScored
  // Chains are hidden by default in results; leads the user saved are always listed.
  const visible = useMemo(
    () => sortLeads(applyFilters(allScored, tab === 'saved' ? { ...filters, showChains: true } : filters)),
    [allScored, filters, tab],
  )
  const chainCount = useMemo(() => allScored.filter((l) => l.isChain).length, [allScored])
  const selected = selectedId ? allScored.find((l) => l.id === selectedId) : undefined
  const savedCount = Object.keys(saved).length

  // ---- search ----
  // A new search lets the server skip Overpass (often blocked from cloud servers) and asks it from the
  // browser instead; "Try full search again" (fullServer) has the server try Overpass as well.
  const runSearch = useCallback(async (req: SearchRequest, opts?: { keepResults?: boolean; fullServer?: boolean }) => {
    const keep = !!opts?.keepResults
    lastReqRef.current = req
    runRef.current?.abort()
    const ctrl = new AbortController()
    runRef.current = ctrl
    const live = () => runRef.current === ctrl && !ctrl.signal.aborted
    setPhase('searching')
    setError(undefined)
    if (!keep) {
      setNotice(undefined)
      setSource(undefined)
      setLeads([])
      setAudits({})
      setPending(new Set())
      setSelectedId(undefined)
    }
    setProgress({ done: 0, total: 0 })
    try {
      let res = await searchLeads(opts?.fullServer ? req : { ...req, skipOverpass: true }, ctrl.signal)
      if (!live()) return
      if (res.source === 'nominatim') {
        const full = await browserOverpassSearch(res.center, req, { signal: ctrl.signal })
        if (!live()) return
        if (full) res = { center: res.center, leads: full, source: 'overpass' }
      }
      setLeads(res.leads)
      setNotice(res.notice)
      setSource(res.source)
      setAudits({})
      setPending(new Set())
      if (keep) setSelectedId((id) => (id && res.leads.some((l) => l.id === id) ? id : undefined))
      setTab('results')
      const withSite = res.leads.filter((l) => l.website?.trim())
      setPending(new Set(withSite.map((l) => l.id)))
      setProgress({ done: 0, total: withSite.length })
      if (withSite.length === 0) {
        setPhase('done')
        return
      }
      setPhase('auditing')
      let done = 0
      for (let i = 0; i < withSite.length; i += BATCH) {
        const batch = withSite.slice(i, i + BATCH)
        const results = await auditLeads(batch.map((l) => ({ id: l.id, website: l.website! })), ctrl.signal)
        if (!live()) return
        setAudits((prev) => ({ ...prev, ...Object.fromEntries(results.map((r) => [r.id, r])) }))
        setPending((prev) => {
          const next = new Set(prev)
          for (const l of batch) next.delete(l.id)
          return next
        })
        done += batch.length
        setProgress({ done, total: withSite.length })
      }
      if (live()) setPhase('done')
    } catch (e) {
      if (!live()) return
      if (e instanceof ApiUnavailableError) setPhase('unavailable')
      else {
        setError(e instanceof Error ? e.message : 'Something went wrong')
        setPhase('error')
      }
    }
  }, [])

  const retryFull = () => {
    if (lastReqRef.current) void runSearch(lastReqRef.current, { keepResults: true, fullServer: true })
  }

  function enterDemo() {
    runRef.current?.abort()
    runRef.current = null
    setMode('demo')
    setLeads(DEMO_LEADS)
    setAudits(DEMO_AUDITS)
    setPending(new Set())
    setNotice(undefined)
    setSource(undefined)
    setError(undefined)
    setSelectedId(undefined)
    setTab('results')
    setPhase('done')
  }

  function exitDemo() {
    setMode('live')
    setLeads([])
    setAudits({})
    setSource(undefined)
    setSelectedId(undefined)
    setPhase('idle')
  }

  // ---- export ----
  function exportCsv() {
    if (visible.length === 0) return
    const blob = new Blob([leadsToCsv(visible, saved)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvFilename(new Date())
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ---- detail panel: Esc + body scroll lock on small screens ----
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !settingsOpen && setSelectedId(undefined)
    window.addEventListener('keydown', onKey)
    const small = window.matchMedia?.('(max-width: 1023px)').matches
    const prev = document.body.style.overflow
    if (small) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selectedId, settingsOpen])

  // ---- pitch ----
  const isDemoLead = !!selected?.isDemo
  const selectedPending = selected?.auditState === 'pending'
  const selectedKey = selected?.id
  useEffect(() => {
    if (!selected || isDemoLead || selectedPending || !selectedKey) return
    if (requested.current.has(selectedKey) || saved[selectedKey]?.pitch || pitches[selectedKey]) return
    requested.current.add(selectedKey)
    const req = pitchRequest(selected, sender)
    fetchPitch(req)
      .then((p) => {
        setPitches((prev) => ({ ...prev, [selectedKey]: p }))
        setPitch(selectedKey, p)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, isDemoLead, selectedPending])

  const currentPitch: Pitch | undefined = useMemo(() => {
    if (!selected) return undefined
    const stored = pitches[selected.id] ?? saved[selected.id]?.pitch
    // Template pitches are rebuilt from the current sender details; AI pitches are kept as written.
    if (stored && stored.source === 'ai') return stored
    return buildTemplatePitch(pitchRequest(selected, sender))
  }, [selected, pitches, saved, sender])

  async function regenerate() {
    if (!selected) return
    const id = selected.id
    const req = pitchRequest(selected, sender)
    setPitchLoading(true)
    try {
      const p = selected.isDemo ? buildTemplatePitch(req) : await fetchPitch(req)
      setPitches((prev) => ({ ...prev, [id]: p }))
      setPitch(id, p)
    } catch {
      // ignore
    } finally {
      setPitchLoading(false)
    }
  }

  const searching = phase === 'searching' || phase === 'auditing'
  const senderMissing = !sender.name.trim() || !sender.business.trim()

  let emptyView = null
  if (!searching && phase !== 'unavailable' && phase !== 'error' && visible.length === 0) {
    if (tab === 'saved') {
      emptyView = savedCount === 0
        ? <EmptyState icon={<Bookmark className="h-8 w-8" />} title="No saved leads yet">Open a lead and press Save to keep it here across searches.</EmptyState>
        : <EmptyState icon={<SearchX className="h-8 w-8" />} title="No saved leads match these filters" />
    } else if (phase === 'idle') {
      emptyView = <EmptyState icon={<Target className="h-8 w-8" />} title="Search a town and category to find leads">Lead Finder lists local businesses and shows what they are missing online.</EmptyState>
    } else if (leads.length === 0) {
      emptyView = <EmptyState icon={<SearchX className="h-8 w-8" />} title="No businesses found">No businesses found. Try a bigger radius or 'Any business'.</EmptyState>
    } else {
      emptyView = <EmptyState icon={<SearchX className="h-8 w-8" />} title="No leads match these filters">Lower the minimum score or clear a filter.</EmptyState>
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {mode === 'demo' && <DemoBanner onExit={exitDemo} />}
      <Header
        tab={tab} onTab={(t) => { setTab(t); setSelectedId(undefined) }}
        resultsCount={leads.length} savedCount={savedCount}
        canExport={visible.length > 0} onExport={exportCsv} onSettings={() => setSettingsOpen(true)}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-3 px-4 py-4">
        <SearchForm onSearch={(r) => void runSearch(r)} searching={searching} demo={mode === 'demo'} />
        {searching && <ProgressBar phase={phase === 'searching' ? 'searching' : 'auditing'} done={progress.done} total={progress.total} />}
        {phase === 'unavailable' && <ApiNotice kind="unavailable" onDemo={enterDemo} />}
        {phase === 'error' && <ApiNotice kind="error" message={error} />}
        {notice && tab === 'results' && (
          <SearchNotice
            message={notice}
            onRetry={source === 'nominatim' ? retryFull : undefined}
            retrying={phase === 'searching' && !!notice}
            disabled={searching || mode === 'demo'}
          />
        )}

        {(allScored.length > 0 || tab === 'saved') && <Filters filters={filters} onChange={setFilters} shown={visible.length} total={allScored.length} chainCount={tab === 'results' ? chainCount : 0} />}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            {emptyView}
            {visible.length > 0 && <LeadList leads={visible} selectedId={selectedId} saved={saved} onSelect={setSelectedId} />}
          </div>
          <aside
            className={clsx(
              selected
                ? 'fixed inset-0 z-40 overflow-y-auto bg-slate-50 lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm'
                : 'hidden rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 lg:block',
            )}
          >
            {selected && currentPitch ? (
              <LeadDetail
                lead={selected}
                saved={saved[selected.id]}
                pitch={currentPitch}
                pitchLoading={pitchLoading}
                senderMissing={senderMissing}
                onClose={() => setSelectedId(undefined)}
                onToggleSave={() => (saved[selected.id] ? remove(selected.id) : save(toLead(selected), selected.audit))}
                onStatus={(s) => setStatus(toLead(selected), selected.audit, s)}
                onNotes={(n) => setNotes(toLead(selected), selected.audit, n)}
                onRegenerate={regenerate}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : (
              'Select a lead to see details'
            )}
          </aside>
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">Map data © OpenStreetMap contributors</a>
      </footer>
      {settingsOpen && <SenderSettings sender={sender} onSave={setSender} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
