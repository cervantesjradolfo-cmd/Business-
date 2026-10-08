import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { DRAFT_BODY_MAX, DRAFT_SUBJECT_MAX, stripFooter, type BuiltEmail } from '../lib/outreach'
import type { Draft, Sender } from '../lib/types'

type Props = {
  built?: BuiltEmail
  step: number // 0 = first email
  sender: Sender
  hasDraft: boolean
  locked: boolean // a send is in progress or its result is unknown: don't change the wording
  onAi: () => Promise<boolean> // false = AI isn't set up, nothing changed
  onSave: (d: Draft) => void
  onReset: () => void
}

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand'
const SOURCE_LABELS = { template: 'Template', ai: 'Written by AI', edited: 'Edited' } as const

// The exact email a sequence step will send, with AI rewrite and hand edits.
export default function EmailPreview({ built, step, sender, hasDraft, locked, onAi, onSave, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<{ subject: string; body: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function writeWithAi() {
    setLoading(true)
    setNote('')
    try {
      const ok = await onAi()
      if (!ok) setNote("AI writing isn't set up on this site (it needs ANTHROPIC_API_KEY on Vercel), so the current wording stays.")
    } finally {
      setLoading(false)
    }
  }

  function save() {
    if (!editing) return
    const body = editing.body.trim()
    if (!body) return setError('The email needs some text.')
    onSave({ body, source: 'edited', ...(step === 0 ? { subject: editing.subject } : {}) })
    setEditing(null)
    setError('')
    setNote('')
  }

  const label = step === 0 ? 'first email' : `follow-up ${step}`
  return (
    <div className="pt-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm font-medium text-brand hover:underline">
        {open ? 'Hide email' : `Preview ${label}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {!built?.ok ? (
            <p className="text-sm text-red-700">{built ? built.error : 'Nothing to preview.'}</p>
          ) : editing ? (
            <>
              {step === 0 && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Subject</span>
                  <input value={editing.subject} maxLength={DRAFT_SUBJECT_MAX} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className={input} />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
                <textarea value={editing.body} maxLength={DRAFT_BODY_MAX} rows={9} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className={input} />
              </label>
              <p className="text-xs text-slate-500">Your signature, postal address and opt-out line are added automatically.</p>
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={save}>Save email</button>
                <button type="button" className={btn} onClick={() => { setEditing(null); setError('') }}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <p className="min-w-0 break-words"><span className="text-slate-500">Subject: </span><span className="font-medium">{built.subject}</span></p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{SOURCE_LABELS[built.source]}</span>
              </div>
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white p-3 font-sans text-sm text-slate-800">{built.body}</pre>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} disabled={loading || locked} onClick={writeWithAi}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {built.source === 'ai' ? 'Rewrite with AI' : 'Write with AI'}
                </button>
                <button type="button" className={btn} disabled={loading || locked} onClick={() => setEditing({ subject: built.subject, body: stripFooter(built.body, sender) })}>Edit</button>
                {hasDraft && <button type="button" className={btn} disabled={loading || locked} onClick={onReset}>Undo changes</button>}
              </div>
              {note && <p role="status" className="text-xs text-amber-800">{note}</p>}
              {locked && <p className="text-xs text-slate-500">This email is being sent or its result is unknown, so it can't be changed.</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
