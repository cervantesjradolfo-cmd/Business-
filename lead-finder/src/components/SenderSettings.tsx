import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { getAccessKey, newProfileId, setAccessKey } from '../lib/storage'
import type { CategoryId, ClientProfile, Sender } from '../lib/types'

// A client profile being edited; isNew until it is saved for the first time.
export type ProfileDraft = { profile: ClientProfile; isNew: boolean }

type Props = {
  sender: Sender
  draft?: ProfileDraft // absent = your own (agency) details
  takenIds?: string[]
  onSave: (s: Sender, profile?: ClientProfile) => void
  onDelete?: () => void
  onClose: () => void
}

const FIELDS: { key: keyof Sender; label: string; clientLabel?: string; type?: string }[] = [
  { key: 'name', label: 'Your name', clientLabel: 'Name to sign with' },
  { key: 'business', label: 'Your business', clientLabel: 'Business name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'address', label: 'Postal address (required by CAN-SPAM)' },
  { key: 'website', label: 'Website' },
]

const TARGETS = CATEGORIES.filter((c) => c.id !== 'any')
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand'
const caption = 'mb-1 block text-xs font-medium text-slate-600'

export default function SenderSettings({ sender, draft, takenIds = [], onSave, onDelete, onClose }: Props) {
  const [details, setDetails] = useState(sender)
  const [profile, setProfile] = useState(draft?.profile)
  const [accessKey, setKey] = useState(getAccessKey)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleCategory(id: CategoryId, on: boolean) {
    if (!profile) return
    const categories = on ? [...profile.categories, id] : profile.categories.filter((c) => c !== id)
    setProfile({ ...profile, categories: TARGETS.map((t) => t.id).filter((t) => categories.includes(t)) })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (profile) {
      const label = profile.label.trim()
      if (!label) return setError('Give the profile a name.')
      if (profile.categories.length === 0) return setError('Pick at least one kind of customer to search for.')
      const id = draft?.isNew ? newProfileId(label, takenIds) : profile.id
      onSave(details, { ...profile, id, label, offer: profile.offer.trim(), sellingPoints: profile.sellingPoints.trim() })
    } else {
      onSave(details)
    }
    setAccessKey(accessKey)
    onClose()
  }

  const title = !profile ? 'Your details' : draft?.isNew ? 'New client profile' : `${profile.label} profile`
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={title} className="max-h-full w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          {profile
            ? "Find businesses that could hire this client, and pitch them as the client. Stored only in this browser."
            : 'Used to sign your pitches. Stored only in this browser.'}
        </p>
        <div className="space-y-3">
          {profile && (
            <>
              <label className="block">
                <span className={caption}>Profile name</span>
                <input value={profile.label} maxLength={80} onChange={(e) => setProfile({ ...profile, label: e.target.value })} placeholder="e.g. Asher Construction" className={input} />
              </label>
              <label className="block">
                <span className={caption}>What they do</span>
                <input value={profile.offer} maxLength={300} onChange={(e) => setProfile({ ...profile, offer: e.target.value })} placeholder="e.g. drywall, metal framing and acoustic ceilings" className={input} />
              </label>
              <label className="block">
                <span className={caption}>Selling points (optional, only true facts)</span>
                <textarea value={profile.sellingPoints} maxLength={500} rows={2} onChange={(e) => setProfile({ ...profile, sellingPoints: e.target.value })} placeholder="e.g. Licensed and insured. Residential and commercial." className={input} />
              </label>
              <fieldset>
                <legend className={caption}>Customers to search for</legend>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {TARGETS.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={profile.categories.includes(c.id)} onChange={(e) => toggleCategory(c.id, e.target.checked)} className="h-4 w-4 accent-brand" />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <h3 className="pt-1 text-sm font-semibold">Who signs the pitches</h3>
            </>
          )}
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className={caption}>{(profile && f.clientLabel) || f.label}</span>
              <input
                type={f.type ?? 'text'} value={details[f.key]} maxLength={200}
                onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })}
                className={input}
              />
            </label>
          ))}
          <label className="block">
            <span className={caption}>Access key (only if this deployment asks for one)</span>
            <input
              type="password" value={accessKey} maxLength={200} autoComplete="off"
              onChange={(e) => setKey(e.target.value)}
              className={input}
            />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {onDelete && (
            confirmDelete ? (
              <button type="button" onClick={() => { onDelete(); onClose() }} className="mr-auto rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
                Delete profile and its saved leads
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="mr-auto rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                Delete profile
              </button>
            )
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Close</button>
          <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">Save</button>
        </div>
      </form>
    </div>
  )
}
