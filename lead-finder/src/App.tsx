import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SearchX, Target, Bookmark } from 'lucide-react'
import clsx from 'clsx'
import { DEMO_AUDITS, DEMO_LEADS } from './data/demo'
import { ApiUnavailableError, auditLeads, fetchPitch, searchLeads, searchProjects } from './lib/api'
import { csvFilename, leadsToCsv } from './lib/csv'
import { applyFilters, sortByContact, sortLeads } from './lib/filters'
import { toLead } from './lib/format'
import { canEnroll, dueSteps, enroll, enrollmentLabel, outreachEmailFor, suppress, syncWithSaved } from './lib/outreach'
import { mailboxKey, outreachKey, useMailbox, useOutreach } from './lib/outreachStore'
import { buildTemplatePitch, pitchRequestFor } from './lib/pitch'
import { useOutreachRunner } from './lib/useOutreachRunner'
import { isEmail } from './lib/validate'
import { scoreLead } from './lib/scoring'
import { EMPTY_SENDER, savedKey, useProfiles, useSavedLeads, useSender } from './lib/storage'
import type { AuditResult, ClientProfile, Filters as FiltersState, Lead, Pitch, ProjectsRequest, SavedLead, ScoredLead, SearchRequest, Sender } from './lib/types'
import ApiNotice from './components/ApiNotice'
import DemoBanner from './components/DemoBanner'
import EmptyState from './components/EmptyState'
import Filters from './components/Filters'
import Header, { NEW_PROFILE } from './components/Header'
import LeadDetail from './components/LeadDetail'
import LeadList from './components/LeadList'
import OutreachTab from './components/OutreachTab'
import ProgressBar, { type PlaceProgress } from './components/ProgressBar'
import SearchForm from './components/SearchForm'
import SenderSettings, { type ProfileDraft } from './components/SenderSettings'

type Phase = 'idle' | 'searching' | 'auditing' | 'done' | 'error' | 'unavailable'

const BATCH = 8

// Owns the profiles. The workspace below is remounted per profile, so each profile starts with
// a fresh search and reads its own saved leads.
export default function App() {
  const { profiles, active, select, saveProfile, deleteProfile } = useProfiles()
  const [agencySender, setAgencySender] = useSender()
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function openSettings() {
    setDraft(active ? { profile: active, isNew: false } : null)
    setSettingsOpen(true)
  }
  function selectProfile(id: string) {
    if (id !== NEW_PROFILE) return select(id)
    setDraft({ profile: { id: '', label: '', offer: '', sellingPoints: '', categories: [], projectKeywords: [], sender: EMPTY_SENDER }, isNew: true })
    setSettingsOpen(true)
  }

  return (
    <>
      <Workspace
        key={active?.id ?? ''}
        profile={active}
        sender={active ? active.sender : agencySender}
        header={{ profiles, activeId: active?.id ?? '', onSelectProfile: selectProfile }}
        settingsOpen={settingsOpen}
        onOpenSettings={openSettings}
      />
      {settingsOpen && (
        <SenderSettings
          sender={draft ? draft.profile.sender : agencySender}
          draft={draft ?? undefined}
          takenIds={profiles.map((p) => p.id)}
          onSave={(sender, profile) => {
            if (!profile) return setAgencySender(sender)
            saveProfile({ ...profile, sender })
            select(profile.id)
          }}
          onDelete={draft && !draft.isNew ? () => deleteProfile(draft.profile.id) : undefined}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}

type WorkspaceProps = {
  profile?: ClientProfile
  sender: Sender
  header: { profiles: ClientProfile[]; activeId: string; onSelectProfile: (id: string) => void }
  settingsOpen: boolean
  onOpenSettings: () => void
}

function Workspace({ profile, sender, header, settingsOpen, onOpenSettings }: WorkspaceProps) {
  const client = !!profile
  const [leads, setLeads] = useState<Lead[]>([])
  const [audits, setAudits] = useState<Record<string, AuditResult>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [notice, setNotice] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  const [tab, setTab] = useState<'results' | 'saved' | 'outreach'>('results')
  const [filters, setFilters] = useState<FiltersState>({ minScore: 0, noWebsiteOnly: false, hasPhone: false, showChains: false })
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [placeProgress, setPlaceProgress] = useState<PlaceProgress | undefined>()
  const [pitches, setPitches] = useState<Record<string, Pitch>>({})
  const [pitchLoading, setPitchLoading] = useState(false)

  const { saved, save, remove, setStatus, setNotes, setPitch, setOutreachEmail } = useSavedLeads(savedKey(profile?.id))
  const outreachStoreKey = outreachKey(profile?.id)
  const outreach = useOutreach(outreachStoreKey)
  const [mailbox, setMailbox] = useMailbox(mailboxKey(profile?.id))
  const [, setTick] = useState(0) // re-render every minute so due counts stay current
  const runRef = useRef<AbortController | null>(null)
  const requested = useRef<Set<string>>(new Set())

  // ---- lists ----
  const resultScored = useMemo(() => leads.map((l) => scoreLead(l, audits[l.id], pending.has(l.id))), [leads, audits, pending])
  const savedScored = useMemo(() => Object.values(saved).map((s) => scoreLead(s.lead, s.audit)), [saved])
  const allScored = tab === 'results' ? resultScored : savedScored // the Outreach tab lists saved leads too
  // Chains are hidden by default in results; leads the user saved are always listed.
  // Client profiles don't use website gaps, so their leads are ranked by how easy they are to reach.
  const visible = useMemo(() => {
    const f = { ...filters, ...(tab === 'saved' ? { showChains: true } : {}), ...(client ? { minScore: 0, noWebsiteOnly: false } : {}) }
    const list = applyFilters(allScored, f)
    return client ? sortByContact(list) : sortLeads(list)
  }, [allScored, filters, tab, client])
  const chainCount = useMemo(() => allScored.filter((l) => l.isChain).length, [allScored])
  const selected = selectedId ? allScored.find((l) => l.id === selectedId) : undefined
  const savedCount = Object.keys(saved).length

  // ---- search ----
  // Starts a new run: cancels the previous one and clears the results.
  const startRun = useCallback(() => {
    runRef.current?.abort()
    const ctrl = new AbortController()
    runRef.current = ctrl
    setPhase('searching')
    setError(undefined)
    setNotice(undefined)
    setLeads([])
    setAudits({})
    setPending(new Set())
    setSelectedId(undefined)
    setProgress({ done: 0, total: 0 })
    setPlaceProgress(undefined)
    setTab('results')
    return { ctrl, live: () => runRef.current === ctrl && !ctrl.signal.aborted }
  }, [])

  // Checks the websites of new leads in batches. Returns false if the run was stopped meanwhile.
  const auditNew = useCallback(async (found: Lead[], signal: AbortSignal, live: () => boolean): Promise<boolean> => {
    // Client profiles don't pitch websites, so there is nothing to audit (project leads have no website).
    const withSite = client ? [] : found.filter((l) => l.website?.trim())
    setPending(new Set(withSite.map((l) => l.id)))
    setProgress({ done: 0, total: withSite.length })
    if (withSite.length === 0) return true
    setPhase('auditing')
    let done = 0
    for (let i = 0; i < withSite.length; i += BATCH) {
      const batch = withSite.slice(i, i + BATCH)
      const results = await auditLeads(batch.map((l) => ({ id: l.id, website: l.website! })), signal)
      if (!live()) return false
      setAudits((prev) => ({ ...prev, ...Object.fromEntries(results.map((r) => [r.id, r])) }))
      setPending((prev) => {
        const next = new Set(prev)
        for (const l of batch) next.delete(l.id)
        return next
      })
      done += batch.length
      setProgress({ done, total: withSite.length })
    }
    return true
  }, [client])

  const failRun = useCallback((e: unknown) => {
    if (e instanceof ApiUnavailableError) setPhase('unavailable')
    else {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPhase('error')
    }
  }, [])

  // Runs a business search or a project search; both return leads and an optional notice.
  const runSearch = useCallback(async (load: (signal: AbortSignal) => Promise<{ leads: Lead[]; notice?: string }>) => {
    const { ctrl, live } = startRun()
    try {
      const res = await load(ctrl.signal)
      if (!live()) return
      setLeads(res.leads)
      setNotice(res.notice)
      if (await auditNew(res.leads, ctrl.signal, live)) setPhase('done')
    } catch (e) {
      if (live()) failRun(e)
    }
  }, [startRun, auditNew, failRun])

  // "Many places": one business search per place, results added to one list as each place finishes.
  // A place that fails is skipped and named at the end; a missing access key or no API stops the run.
  const runPlaces = useCallback(async (places: string[], base: Omit<SearchRequest, 'location'>) => {
    const { ctrl, live } = startRun()
    const seen = new Set<string>()
    const failed: string[] = []
    for (let i = 0; i < places.length; i++) {
      setPlaceProgress({ place: places[i], index: i + 1, total: places.length })
      setPhase('searching')
      let found: Lead[]
      try {
        found = (await searchLeads({ ...base, location: places[i] }, ctrl.signal)).leads
      } catch (e) {
        if (!live()) return
        if (e instanceof ApiUnavailableError || (e instanceof Error && e.message.startsWith('Access key required'))) return failRun(e)
        failed.push(places[i])
        continue
      }
      if (!live()) return
      const fresh = found.filter((l) => !seen.has(l.id))
      for (const l of fresh) seen.add(l.id)
      setLeads((prev) => [...prev, ...fresh])
      if (!(await auditNew(fresh, ctrl.signal, live))) return
    }
    setPlaceProgress(undefined)
    if (failed.length) setNotice(`Searched ${places.length - failed.length} of ${places.length} places. Couldn't search: ${failed.join('; ')}.`)
    setPhase('done')
  }, [startRun, auditNew, failRun])

  // Stops a run but keeps what was found; leads not checked yet show "Website not checked".
  function stopRun() {
    runRef.current?.abort()
    runRef.current = null
    setPending(new Set())
    setPlaceProgress(undefined)
    setPhase('done')
  }

  function enterDemo() {
    runRef.current?.abort()
    runRef.current = null
    setMode('demo')
    setLeads(DEMO_LEADS)
    setAudits(DEMO_AUDITS)
    setPending(new Set())
    setNotice(undefined)
    setError(undefined)
    setSelectedId(undefined)
    setTab('results')
    setPhase('done')
  }

  function exitDemo() {
    setMode('live')
    setLeads([])
    setAudits({})
    setSelectedId(undefined)
    setPhase('idle')
  }

  // ---- export ----
  function exportCsv() {
    if (visible.length === 0) return
    const blob = new Blob([leadsToCsv(visible, saved, client)], { type: 'text/csv;charset=utf-8' })
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
    const req = pitchRequestFor(selected, sender, profile)
    fetchPitch(req)
      .then((p) => {
        setPitches((prev) => ({ ...prev, [selectedKey]: p }))
        setPitch(selectedKey, p)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, isDemoLead, selectedPending])

  // The pitch the Pitch panel shows for a lead (also what outreach sends as step 1).
  const pitchOf = useCallback((l: ScoredLead): Pitch => {
    const stored = pitches[l.id] ?? saved[l.id]?.pitch
    // Template pitches are rebuilt from the current sender details; AI pitches are kept as written.
    if (stored && stored.source === 'ai') return stored
    return buildTemplatePitch(pitchRequestFor(l, sender, profile))
  }, [pitches, saved, sender, profile])
  const currentPitch: Pitch | undefined = useMemo(() => (selected ? pitchOf(selected) : undefined), [selected, pitchOf])

  // ---- outreach ----
  const pitchForSaved = useCallback((s: SavedLead) => pitchOf(scoreLead(s.lead, s.audit)), [pitchOf])
  const markContacted = useCallback((s: SavedLead) => {
    if (s.status === 'new') setStatus(s.lead, s.audit, 'contacted')
  }, [setStatus])
  const runner = useOutreachRunner({
    outreach, outreachKey: outreachStoreKey, saved, mailbox, sender, profile, pitchFor: pitchForSaved, markContacted,
  })
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const { update: updateOutreach } = outreach
  const { campaign, suppressed } = outreach.state
  // Stop sequences for leads that were removed, answered or unsubscribed, and finish ones past the end of the sequence.
  useEffect(() => {
    updateOutreach((s) => syncWithSaved(s, saved))
  }, [saved, campaign, suppressed, updateOutreach])
  const now = new Date()
  const outreachDue = dueSteps(outreach.state, saved, now).length

  async function regenerate() {
    if (!selected) return
    const id = selected.id
    const req = pitchRequestFor(selected, sender, profile)
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

  // Props for the lead panel's Outreach section (saved leads only).
  const sel = selected ? saved[selected.id] : undefined
  const selEnrollment = sel ? outreach.state.enrollments[sel.lead.id] : undefined
  const outreachProps = sel
    ? {
        outreach: {
          email: outreachEmailFor(sel),
          emailError: outreachEmailFor(sel) && !isEmail(outreachEmailFor(sel)) ? 'Enter a valid email address' : undefined,
          enrollment: selEnrollment,
          dueLabel: selEnrollment ? enrollmentLabel(selEnrollment, outreach.state.campaign) : undefined,
          check: canEnroll(sel, outreach.state),
        },
        onOutreachEmail: (email: string) => setOutreachEmail(sel.lead.id, email),
        onEnroll: () => outreach.update((s) => enroll(s, sel, new Date())),
        onUnsubscribe: () => selEnrollment && outreach.update((s) => suppress(s, selEnrollment.email)),
      }
    : {}

  const searching = phase === 'searching' || phase === 'auditing'
  const senderMissing = !sender.name.trim() || !sender.business.trim()

  let emptyView = null
  if (!searching && phase !== 'unavailable' && phase !== 'error' && visible.length === 0) {
    if (tab === 'saved') {
      emptyView = savedCount === 0
        ? <EmptyState icon={<Bookmark className="h-8 w-8" />} title="No saved leads yet">Open a lead and press Save to keep it here across searches.</EmptyState>
        : <EmptyState icon={<SearchX className="h-8 w-8" />} title="No saved leads match these filters" />
    } else if (phase === 'idle') {
      emptyView = profile
        ? <EmptyState icon={<Target className="h-8 w-8" />} title={`Find customers for ${profile.label}`}>
            {profile.projectKeywords.length > 0
              ? `Search a town to list active jobs that need ${profile.label}'s kind of work, or businesses that could hire them. Each comes with a pitch written as ${profile.label}.`
              : `Search a town to list businesses that could hire ${profile.label}, with a pitch written as ${profile.label}.`}
          </EmptyState>
        : <EmptyState icon={<Target className="h-8 w-8" />} title="Search a town and category to find leads">Lead Finder lists local businesses and shows what they are missing online.</EmptyState>
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
        tab={tab} outreachDue={outreachDue} onTab={(t) => { setTab(t); setSelectedId(undefined) }}
        resultsCount={leads.length} savedCount={savedCount}
        canExport={tab !== 'outreach' && visible.length > 0} onExport={exportCsv} onSettings={onOpenSettings}
        {...header}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-3 px-4 py-4">
        <SearchForm
          onSearch={(req: SearchRequest) => runSearch((signal) => searchLeads(req, signal))}
          onSearchProjects={(req: ProjectsRequest) => runSearch((signal) => searchProjects(req, signal))}
          onSearchPlaces={runPlaces}
          searching={searching} demo={mode === 'demo'} profile={profile}
        />
        {searching && <ProgressBar phase={phase === 'searching' ? 'searching' : 'auditing'} done={progress.done} total={progress.total} place={placeProgress} onStop={placeProgress ? stopRun : undefined} />}
        {phase === 'unavailable' && <ApiNotice kind="unavailable" onDemo={enterDemo} />}
        {phase === 'error' && <ApiNotice kind="error" message={error} />}
        {notice && tab === 'results' && (
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
        )}

        {tab === 'outreach' && (
          <OutreachTab
            state={outreach.state} update={outreach.update} saved={saved} mailbox={mailbox} onMailbox={setMailbox}
            sender={sender} profile={profile} now={now} pitchFor={pitchForSaved} markContacted={markContacted}
            status={runner.status} onRun={runner.runNow} onStop={runner.stop} onAuto={runner.setAuto} onTest={runner.sendTest}
            onOpenLead={(id) => { setTab('saved'); setSelectedId(id) }} onOpenSettings={onOpenSettings}
          />
        )}

        {tab !== 'outreach' && (allScored.length > 0 || tab === 'saved') && <Filters client={client} filters={filters} onChange={setFilters} shown={visible.length} total={allScored.length} chainCount={tab === 'results' ? chainCount : 0} />}

        {tab !== 'outreach' && <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            {emptyView}
            {visible.length > 0 && <LeadList leads={visible} selectedId={selectedId} saved={saved} onSelect={setSelectedId} client={client} />}
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
                profile={profile}
                onClose={() => setSelectedId(undefined)}
                onToggleSave={() => (saved[selected.id] ? remove(selected.id) : save(toLead(selected), selected.audit))}
                onStatus={(s) => setStatus(toLead(selected), selected.audit, s)}
                onNotes={(n) => setNotes(toLead(selected), selected.audit, n)}
                onRegenerate={regenerate}
                onOpenSettings={onOpenSettings}
                {...outreachProps}
              />
            ) : (
              'Select a lead to see details'
            )}
          </aside>
        </div>}
      </main>
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">Map data © OpenStreetMap contributors</a>
      </footer>
    </div>
  )
}
