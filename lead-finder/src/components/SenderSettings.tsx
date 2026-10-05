import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { getAccessKey, setAccessKey } from '../lib/storage'
import type { Sender } from '../lib/types'

type Props = { sender: Sender; onSave: (s: Sender) => void; onClose: () => void }

const FIELDS: { key: keyof Sender; label: string; type?: string; placeholder?: string }[] = [
  { key: 'name', label: 'Your name' },
  { key: 'business', label: 'Your business' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'address', label: 'Postal address (required by CAN-SPAM)' },
  { key: 'website', label: 'Website' },
]

export default function SenderSettings({ sender, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(sender)
  const [accessKey, setKey] = useState(getAccessKey)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(draft)
    setAccessKey(accessKey)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Your details" className="max-h-full w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Your details</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-slate-500">Used to sign your pitches. Stored only in this browser.</p>
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{f.label}</span>
              <input
                type={f.type ?? 'text'} value={draft[f.key]} maxLength={200}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Access key (only if this deployment asks for one)</span>
            <input
              type="password" value={accessKey} maxLength={200} autoComplete="off"
              onChange={(e) => setKey(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Close</button>
          <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">Save</button>
        </div>
      </form>
    </div>
  )
}
