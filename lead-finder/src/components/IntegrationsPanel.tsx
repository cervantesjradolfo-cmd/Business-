import { useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { crmReportText, sendToCrm } from '../lib/crm'
import type { Integrations, SavedLead } from '../lib/types'

type Props = { integrations: Integrations; saved: Record<string, SavedLead> }

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

const ROWS: { key: keyof Integrations; name: string; what: string; env: string }[] = [
  { key: 'slack', name: 'Slack', what: 'a message when a lead replies or books', env: 'SLACK_WEBHOOK_URL' },
  { key: 'webhook', name: 'Webhook (Zapier, Make, n8n)', what: 'the same alerts as JSON, to connect anything else', env: 'ALERT_WEBHOOK_URL' },
  { key: 'hubspot', name: 'HubSpot', what: 'leads become contacts with a lead status', env: 'HUBSPOT_TOKEN' },
  { key: 'ghl', name: 'GoHighLevel', what: 'leads become contacts, tagged lead-finder', env: 'GHL_TOKEN and GHL_LOCATION_ID' },
]

// What is connected, and a button to send every saved lead to the CRM.
export default function IntegrationsPanel({ integrations, saved }: Props) {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState('')
  const crm = integrations.hubspot || integrations.ghl
  const all = Object.values(saved)

  async function sendAll() {
    setBusy(true)
    setReport('')
    try {
      setReport(crmReportText(await sendToCrm(all)))
    } catch (e) {
      setReport(e instanceof Error ? e.message : 'Sending to the CRM failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Alerts and CRM" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Alerts and CRM</h3>
      <ul className="space-y-1.5 text-sm">
        {ROWS.map((r) => (
          <li key={r.key} className="flex items-start gap-2">
            {integrations[r.key]
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Connected" />
              : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-label="Not set up" />}
            <span><span className="font-medium">{r.name}</span>: {r.what}.{!integrations[r.key] && <span className="text-slate-500"> Set {r.env} in Vercel to turn it on.</span>}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        When connected, a real reply sends an alert and updates the lead in your CRM, and so do Meeting booked and status changes in the lead panel.
        Opt-outs and auto-replies don't alert.
      </p>
      {crm && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} disabled={busy || all.length === 0} onClick={sendAll}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Send all saved leads to CRM ({all.length})
          </button>
          {report && <span role="status" className="text-sm text-slate-600">{report}</span>}
        </div>
      )}
    </section>
  )
}
