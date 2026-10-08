import { useState } from 'react'
import { MAILBOX_PRESETS, mailboxReady } from '../lib/outreach'
import { isEmail } from '../lib/validate'
import type { Mailbox, Sender, SendResult } from '../lib/types'

type Props = {
  mailbox: Mailbox
  sender: Sender // from name and address default to these
  onSave: (m: Mailbox) => void
  onTest: () => Promise<SendResult>
}

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand'
const caption = 'mb-1 block text-xs font-medium text-slate-600'
const btn = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const PORTS = [465, 587, 2525] as const

const num = (v: string, min: number, max: number, def: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && v.trim() !== '' ? Math.min(max, Math.max(min, n)) : def
}

export default function MailboxSettings({ mailbox, sender, onSave, onTest }: Props) {
  const [m, setM] = useState<Mailbox>({
    ...mailbox,
    fromName: mailbox.fromName || sender.name,
    fromAddress: mailbox.fromAddress || sender.email,
  })
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<SendResult | undefined>()

  const preset = MAILBOX_PRESETS.find((p) => p.host && p.host === m.host)?.id ?? 'other'
  const edit = (patch: Partial<Mailbox>) => {
    setM({ ...m, ...patch })
    setSaved(false)
    setResult(undefined)
  }
  const missing = !m.host.trim() || !m.user.trim() || !m.pass ? 'Fill in the server, username and app password.' : !isEmail(m.fromAddress) ? 'Enter a valid from address.' : ''
  // The test sends with the saved settings, so unsaved edits must be saved first.
  const same = JSON.stringify(m) === JSON.stringify(mailbox)

  function pickPreset(id: string) {
    const p = MAILBOX_PRESETS.find((x) => x.id === id)
    if (p) edit({ host: p.host, port: p.port, secure: p.port === 465 })
  }

  function save() {
    if (missing) return
    onSave({ ...m, host: m.host.trim(), fromAddress: m.fromAddress.trim() })
    setSaved(true)
  }

  async function test() {
    setTesting(true)
    setResult(undefined)
    try {
      setResult(await onTest())
    } finally {
      setTesting(false)
    }
  }

  return (
    <section aria-label="Mailbox" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Mailbox</h3>
      <p className="text-xs text-slate-500">Stored only in this browser. Sent to your server only when an email is sent.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={caption}>Provider</span>
          <select value={preset} onChange={(e) => pickPreset(e.target.value)} className={input}>
            {MAILBOX_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={caption}>Mail server (host)</span>
          <input value={m.host} maxLength={253} onChange={(e) => edit({ host: e.target.value })} placeholder="smtp.example.com" className={input} />
        </label>
        <label className="block">
          <span className={caption}>Port</span>
          <select value={m.port} onChange={(e) => edit({ port: Number(e.target.value) as Mailbox['port'], secure: e.target.value === '465' })} className={input}>
            {PORTS.map((p) => <option key={p} value={p}>{p === 465 ? '465 (SSL)' : `${p} (STARTTLS)`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={caption}>Username</span>
          <input value={m.user} maxLength={254} autoComplete="off" onChange={(e) => edit({ user: e.target.value })} className={input} />
        </label>
        <label className="block">
          <span className={caption}>App password</span>
          <input type="password" value={m.pass} maxLength={200} autoComplete="off" onChange={(e) => edit({ pass: e.target.value })} className={input} />
        </label>
        <label className="block">
          <span className={caption}>From name</span>
          <input value={m.fromName} maxLength={100} onChange={(e) => edit({ fromName: e.target.value.replace(/[\r\n]/g, ' ') })} className={input} />
        </label>
        <label className="block">
          <span className={caption}>From address</span>
          <input type="email" value={m.fromAddress} maxLength={254} onChange={(e) => edit({ fromAddress: e.target.value })} className={input} />
        </label>
        <label className="block">
          <span className={caption}>Seconds between emails (20 to 300)</span>
          <input type="number" min={20} max={300} value={m.gapSeconds} onChange={(e) => edit({ gapSeconds: num(e.target.value, 20, 300, 45) })} className={input} />
        </label>
        <label className="block">
          <span className={caption}>Daily limit (1 to 200)</span>
          <input type="number" min={1} max={200} value={m.dailyCap} onChange={(e) => edit({ dailyCap: num(e.target.value, 1, 200, 30) })} className={input} />
        </label>
      </div>
      {missing && <p className="text-xs text-slate-500">{missing}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={!!missing} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">Save mailbox</button>
        <button type="button" onClick={test} disabled={testing || !same || !mailboxReady(mailbox)} className={btn}>
          {testing ? 'Sending…' : 'Send test email to myself'}
        </button>
        {saved && <span role="status" className="text-xs text-green-700">Saved</span>}
      </div>
      {!same && !missing && !saved && <p className="text-xs text-slate-500">Save the mailbox to send a test email.</p>}
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'text-sm text-green-700' : 'text-sm text-red-700'}>
          {result.ok ? `Test email sent to ${m.fromAddress}.` : result.error}
        </p>
      )}
    </section>
  )
}
