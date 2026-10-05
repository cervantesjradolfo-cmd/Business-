import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react'
import { copyText } from '../lib/clipboard'
import type { Pitch } from '../lib/types'

type Props = { pitch: Pitch; loading: boolean; onRegenerate: () => void; senderMissing: boolean; onOpenSettings: () => void }
type Tab = 'email' | 'sms' | 'call'

export default function PitchPanel({ pitch, loading, onRegenerate, senderMissing, onOpenSettings }: Props) {
  const [tab, setTab] = useState<Tab>('email')
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const blockRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const text = tab === 'email' ? pitch.email.body : tab === 'sms' ? pitch.sms : pitch.phoneOpener
  const copyValue = tab === 'email' ? `Subject: ${pitch.email.subject}\n\n${pitch.email.body}` : text

  async function copy() {
    const ok = await copyText(copyValue)
    setFailed(!ok)
    setCopied(ok)
    if (!ok && blockRef.current) {
      const range = document.createRange()
      range.selectNodeContents(blockRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }

  const tabs: [Tab, string][] = [['email', 'Email'], ['sms', 'Text'], ['call', 'Call']]
  return (
    <section aria-label="Pitch" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Pitch</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{pitch.source === 'ai' ? 'Written by AI' : 'Template'}</span>
      </div>
      {senderMissing && (
        <button type="button" onClick={onOpenSettings} className="w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100">
          Add your details so pitches are signed and CAN-SPAM-compliant
        </button>
      )}
      <div role="tablist" className="flex gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id} type="button" role="tab" aria-selected={tab === id}
            onClick={() => { setTab(id); setFailed(false) }}
            className={clsx('rounded-lg px-3 py-1 text-sm font-medium', tab === id ? 'bg-indigo-50 text-brand' : 'text-slate-600 hover:bg-slate-100')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'email' && <p className="text-sm"><span className="text-slate-500">Subject: </span><span className="font-medium">{pitch.email.subject}</span></p>}
      <pre ref={blockRef} className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-sm text-slate-800">{text}</pre>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={onRegenerate} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Regenerate
        </button>
        {failed && <span className="text-xs text-slate-500">Press Ctrl/Cmd+C to copy</span>}
      </div>
    </section>
  )
}
