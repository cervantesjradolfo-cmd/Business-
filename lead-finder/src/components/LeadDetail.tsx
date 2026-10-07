import { ArrowLeft, Bookmark, BookmarkCheck, Clock, Globe, Loader2, Mail, MapPin, Phone } from 'lucide-react'
import { PRICING } from '../data/pricing'
import { googleMapsUrl, googleSearchUrl } from '../lib/geo'
import { formatDate, formatMiles, formatRange, formatUsd } from '../lib/format'
import { STATUS_LABELS } from '../lib/csv'
import type { ClientProfile, Enrollment, LeadStatus, Pitch, SavedLead, ScoredLead } from '../lib/types'
import type { EnrollCheck } from '../lib/outreach'
import PitchPanel from './PitchPanel'
import ScoreBadge from './ScoreBadge'

type Props = {
  lead: ScoredLead
  saved?: SavedLead
  pitch: Pitch
  pitchLoading: boolean
  senderMissing: boolean
  profile?: ClientProfile // set when pitching on a client's behalf
  onClose: () => void
  onToggleSave: () => void
  onStatus: (s: LeadStatus) => void
  onNotes: (n: string) => void
  onRegenerate: () => void
  onOpenSettings: () => void
  outreach?: { email: string; emailError?: string; enrollment?: Enrollment; dueLabel?: string; check: EnrollCheck }
  onOutreachEmail?: (email: string) => void
  onEnroll?: () => void
  onUnsubscribe?: () => void
}

const NOT_LISTED = <span className="text-slate-400">Not listed</span>
const link = 'text-brand hover:underline break-all'

function webHref(raw: string): string {
  const first = raw.split(';')[0].trim()
  return /^https?:\/\//i.test(first) ? first : `https://${first}`
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="mt-0.5 text-slate-400" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <span className="sr-only">{label}: </span>
        {children}
      </div>
    </div>
  )
}

export default function LeadDetail(p: Props) {
  const { lead } = p
  return (
    <div className="space-y-4 p-4">
      <button type="button" onClick={p.onClose} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 lg:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden />Close
      </button>

      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold leading-tight break-words">{lead.name}</h2>
          {!p.profile && <ScoreBadge score={lead.score} />}
        </div>
        <p className="mt-1 text-sm text-slate-500">{lead.category} · {formatMiles(lead.distanceKm)} away</p>
      </div>

      {lead.project && (
        <section aria-label="Project" className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <h3 className="font-semibold">Project</h3>
          <p><span className="text-slate-500">Job site: </span>{lead.project.address}, {lead.project.city}</p>
          <p className="break-words">{lead.project.description}</p>
          <p className="text-slate-600">
            Permit {lead.project.permit} · issued {formatDate(lead.project.issued)}
            {lead.project.cost ? ` · reported cost ${formatUsd(lead.project.cost)}` : ''}
          </p>
          {lead.project.architect && <p><span className="text-slate-500">Architect: </span>{lead.project.architect}</p>}
          <p className="text-xs text-slate-500">
            From the City of {lead.project.city}'s public building-permit data. The permit doesn't list the contractor's phone or email, so look them up before you reach out.
          </p>
        </section>
      )}

      <section className="space-y-2" aria-label="Contact">
        <Row icon={<Phone className="h-4 w-4" />} label="Phone">
          {lead.phone ? <a className={link} href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>{lead.phone}</a> : NOT_LISTED}
        </Row>
        <Row icon={<Mail className="h-4 w-4" />} label="Email">
          {lead.email ? <a className={link} href={`mailto:${lead.email}`}>{lead.email}</a> : NOT_LISTED}
        </Row>
        <Row icon={<Globe className="h-4 w-4" />} label="Website">
          {lead.website ? <a className={link} href={webHref(lead.website)} target="_blank" rel="noopener noreferrer">{lead.website}</a> : NOT_LISTED}
        </Row>
        {!lead.project && (
          <>
            <Row icon={<MapPin className="h-4 w-4" />} label="Address">
              {lead.address ? <span className="break-words">{lead.address}</span> : NOT_LISTED}
            </Row>
            <Row icon={<Clock className="h-4 w-4" />} label="Opening hours">
              {lead.openingHours ? <span className="break-words">{lead.openingHours}</span> : NOT_LISTED}
            </Row>
          </>
        )}
        <div className="flex flex-wrap gap-3 pt-1 text-sm">
          {lead.project ? (
            <>
              <a className={link} href={googleSearchUrl(`${lead.name} ${lead.project.city}`)} target="_blank" rel="noopener noreferrer">Look up {lead.name}</a>
              <a className={link} href={googleMapsUrl({ ...lead, name: lead.project.address, address: lead.project.city })} target="_blank" rel="noopener noreferrer">Job site on Google Maps</a>
            </>
          ) : (
            <>
              <a className={link} href={googleMapsUrl(lead)} target="_blank" rel="noopener noreferrer">Google Maps</a>
              <a className={link} href={lead.osmUrl} target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
            </>
          )}
        </div>
      </section>

      {!p.profile && (
        <>
          <section aria-label="Gaps">
            <h3 className="mb-1 text-sm font-semibold">Gaps found</h3>
            {lead.auditState === 'pending' && (
              <p className="mb-1 flex items-center gap-1 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking website…</p>
            )}
            {lead.gaps.length === 0 && lead.auditState !== 'pending' ? (
              <p className="text-sm text-slate-500">No gaps found.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {lead.gaps.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{g.label}</span>
                    {g.detail && <span className="text-xs text-slate-500">{g.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
            {lead.audit?.note && lead.audit.status !== 'unreachable' && <p className="mt-1 text-xs text-slate-500">{lead.audit.note}</p>}
            {lead.auditState === 'done' && lead.website && !lead.audit && <p className="mt-1 text-xs text-slate-500">Website not checked</p>}
          </section>

          <section aria-label="Services">
            <h3 className="mb-1 text-sm font-semibold">Recommended services</h3>
            {lead.services.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {lead.services.map((s) => (
                  <li key={s} className="flex justify-between gap-2">
                    <span>{PRICING[s].label}</span>
                    <span className="shrink-0 text-slate-500">{formatRange(PRICING[s])}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-brand">
              Est. deal value {formatUsd(lead.dealValue.min)}–{formatUsd(lead.dealValue.max)}
            </p>
          </section>
        </>
      )}

      <section aria-label="Tracking" className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select value={p.saved?.status ?? 'new'} onChange={(e) => p.onStatus(e.target.value as LeadStatus)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <button type="button" onClick={p.onToggleSave} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            {p.saved ? <BookmarkCheck className="h-4 w-4 text-brand" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
            {p.saved ? 'Remove' : 'Save'}
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
          <textarea value={p.saved?.notes ?? ''} onChange={(e) => p.onNotes(e.target.value)} rows={3} placeholder="Call log, next steps…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </section>

      {p.saved && p.outreach && (
        <section aria-label="Outreach" className="space-y-2">
          <h3 className="text-sm font-semibold">Outreach</h3>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email for outreach</span>
            <input
              type="email" value={p.outreach.email} maxLength={254}
              readOnly={p.outreach.enrollment?.state === 'active'}
              onChange={(e) => p.onOutreachEmail?.(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand read-only:bg-slate-50 read-only:text-slate-500"
            />
          </label>
          {p.outreach.enrollment?.state === 'active' && <p className="text-xs text-slate-500">Remove it from outreach to change the address</p>}
          {p.outreach.emailError && <p role="alert" className="text-xs text-red-700">{p.outreach.emailError}</p>}
          {p.outreach.enrollment ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{p.outreach.dueLabel}</span>
              {p.outreach.enrollment.state !== 'stopped' && (
                <button type="button" onClick={p.onUnsubscribe} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Unsubscribed</button>
              )}
            </div>
          ) : (
            <div>
              <button
                type="button" onClick={p.onEnroll} disabled={!p.outreach.check.ok}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add to outreach
              </button>
              {!p.outreach.check.ok && <p className="mt-1 text-xs text-slate-500">{p.outreach.check.reason}</p>}
            </div>
          )}
        </section>
      )}

      <PitchPanel pitch={p.pitch} loading={p.pitchLoading} onRegenerate={p.onRegenerate} senderMissing={p.senderMissing} onOpenSettings={p.onOpenSettings} from={p.profile?.label} />
    </div>
  )
}
