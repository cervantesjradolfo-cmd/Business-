// Alerts (Slack, any webhook such as Zapier or Make) and CRM sync (HubSpot, GoHighLevel).
// Every destination and token comes from environment variables, never from the request, so the API
// can't be pointed at other servers. Errors are fixed messages: no token or response body is returned.
import type { AlertRequest, CrmLead, CrmResult, Integrations } from '../src/lib/types.js'
import { fetchWithTimeout } from './http.js'

const env = (k: string) => (process.env[k] ?? '').trim()
const TIMEOUT_MS = 10_000

export function integrations(): Integrations {
  return {
    slack: /^https:\/\/hooks\.slack\.com\//.test(env('SLACK_WEBHOOK_URL')),
    webhook: /^https:\/\//.test(env('ALERT_WEBHOOK_URL')),
    hubspot: !!env('HUBSPOT_TOKEN'),
    ghl: !!env('GHL_TOKEN') && !!env('GHL_LOCATION_ID'),
  }
}

// ---- alerts ----

const slackEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function alertText(a: AlertRequest): string {
  const who = a.lead.name + (a.from ? ` (${a.from})` : '')
  const head = a.event === 'booked' ? `Meeting booked: ${who}` : `New reply from ${who}${a.intentLabel ? ` · ${a.intentLabel}` : ''}`
  return [head, a.summary, a.text ? `"${a.text.slice(0, 500)}"` : ''].filter(Boolean).join('\n')
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
    timeoutMs: TIMEOUT_MS,
  })
}

// Sends the alert everywhere that is set up. Returns where it went.
export async function sendAlert(a: AlertRequest): Promise<{ sent: string[]; failed: string[] }> {
  const on = integrations()
  const jobs: [string, () => Promise<Response>][] = []
  if (on.slack) jobs.push(['Slack', () => post(env('SLACK_WEBHOOK_URL'), { text: slackEscape(alertText(a)) })])
  if (on.webhook) jobs.push(['Webhook', () => post(env('ALERT_WEBHOOK_URL'), { source: 'lead-finder', ...a, text: a.text?.slice(0, 2000) })])
  const sent: string[] = []
  const failed: string[] = []
  await Promise.all(jobs.map(async ([name, run]) => {
    try {
      const res = await run()
      ;(res.ok ? sent : failed).push(name)
    } catch {
      failed.push(name)
    }
  }))
  return { sent, failed }
}

// ---- CRM ----

const HUBSPOT_STATUS: Record<CrmLead['status'], string> = {
  new: 'NEW', contacted: 'ATTEMPTED_TO_CONTACT', replied: 'CONNECTED', booked: 'OPEN_DEAL', won: 'OPEN_DEAL', lost: 'UNQUALIFIED',
}

const crmError = (status: number): string =>
  status === 401 || status === 403 ? 'The CRM refused the token. Check it and its permissions (scopes).'
    : status === 429 ? 'The CRM is rate limiting. Try again in a minute.'
      : `The CRM answered with an error (HTTP ${status}).`

export async function hubspotUpsert(leads: CrmLead[]): Promise<{ sent: number; skipped: number; error?: string }> {
  const withEmail = leads.filter((l) => l.email)
  const skipped = leads.length - withEmail.length
  if (withEmail.length === 0) return { sent: 0, skipped }
  try {
    const res = await post('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
      inputs: withEmail.map((l) => ({
        idProperty: 'email',
        id: l.email,
        properties: {
          email: l.email,
          company: l.name,
          ...(l.website ? { website: l.website } : {}),
          ...(l.phone ? { phone: l.phone } : {}),
          ...(l.city ? { city: l.city } : {}),
          ...(l.address ? { address: l.address } : {}),
          hs_lead_status: HUBSPOT_STATUS[l.status],
        },
      })),
    }, { Authorization: `Bearer ${env('HUBSPOT_TOKEN')}` })
    if (!res.ok) return { sent: 0, skipped, error: crmError(res.status) }
    return { sent: withEmail.length, skipped }
  } catch {
    return { sent: 0, skipped, error: "Couldn't reach HubSpot." }
  }
}

export async function ghlUpsert(leads: CrmLead[]): Promise<{ sent: number; skipped: number; error?: string }> {
  const reachable = leads.filter((l) => l.email || l.phone)
  const skipped = leads.length - reachable.length
  let sent = 0
  for (const l of reachable) {
    try {
      const res = await post('https://services.leadconnectorhq.com/contacts/upsert', {
        locationId: env('GHL_LOCATION_ID'),
        companyName: l.name,
        name: l.name,
        ...(l.email ? { email: l.email } : {}),
        ...(l.phone ? { phone: l.phone } : {}),
        ...(l.website ? { website: l.website } : {}),
        ...(l.city ? { city: l.city } : {}),
        ...(l.address ? { address1: l.address } : {}),
        source: 'Lead Finder',
        tags: ['lead-finder', `lead-finder-${l.status}`],
      }, { Authorization: `Bearer ${env('GHL_TOKEN')}`, Version: '2021-07-28', Accept: 'application/json' })
      if (!res.ok) return { sent, skipped, error: crmError(res.status) }
      sent++
    } catch {
      return { sent, skipped, error: "Couldn't reach GoHighLevel." }
    }
  }
  return { sent, skipped }
}

export async function syncCrm(leads: CrmLead[]): Promise<CrmResult> {
  const on = integrations()
  const [hubspot, ghl] = await Promise.all([
    on.hubspot ? hubspotUpsert(leads) : Promise.resolve(undefined),
    on.ghl ? ghlUpsert(leads) : Promise.resolve(undefined),
  ])
  return { ...(hubspot ? { hubspot } : {}), ...(ghl ? { ghl } : {}) }
}
