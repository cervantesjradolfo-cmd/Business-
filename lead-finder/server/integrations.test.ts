// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alertText, integrations, sendAlert, syncCrm } from './integrations'
import { POST as crmPOST } from '../api/crm'
import { POST as notifyPOST } from '../api/notify'
import { GET as integrationsGET } from '../api/integrations'

const KEYS = ['SLACK_WEBHOOK_URL', 'ALERT_WEBHOOK_URL', 'HUBSPOT_TOKEN', 'GHL_TOKEN', 'GHL_LOCATION_ID', 'APP_ACCESS_KEY']
const saved: Record<string, string | undefined> = {}
let calls: { url: string; init: RequestInit; body: any }[]

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k] }
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body as string) })
    return new Response('{}', { status: 200 })
  }))
})
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  vi.unstubAllGlobals()
})

const req = (path: string, body: unknown) => new Request(`http://localhost/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const lead = { name: 'Corner Cafe', email: 'owner@corner.example.com', phone: '555-0100', website: 'cornercafe.example.com', city: 'Austin', status: 'replied' as const }

describe('integrations', () => {
  it('reports only what is set up, never the secrets', async () => {
    expect(integrations()).toEqual({ slack: false, webhook: false, hubspot: false, ghl: false })
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/x'
    process.env.ALERT_WEBHOOK_URL = 'http://insecure.example.com/hook' // https only
    process.env.HUBSPOT_TOKEN = 'pat-secret'
    process.env.GHL_TOKEN = 'ghl-secret' // needs the location id too
    expect(integrations()).toEqual({ slack: true, webhook: false, hubspot: true, ghl: false })
    const text = await (await integrationsGET(new Request('http://localhost/api/integrations'))).text()
    expect(text).not.toContain('secret')
  })
})

describe('alerts', () => {
  it('posts to Slack (escaped) and the webhook, and only to the configured addresses', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/x'
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1/abc/'
    const res = await notifyPOST(req('notify', { event: 'reply', lead: { name: 'Corner <Cafe>' }, from: 'owner@corner.example.com', intentLabel: 'Has a question', summary: 'Asks the price', text: 'How much?', url: 'https://evil.example.com' }))
    expect(await res.json()).toEqual({ sent: ['Slack', 'Webhook'], failed: [] })
    expect(calls.map((c) => c.url).sort()).toEqual(['https://hooks.slack.com/services/T/B/x', 'https://hooks.zapier.com/hooks/catch/1/abc/'])
    const slack = calls.find((c) => c.url.includes('slack'))!.body
    expect(slack.text).toBe('New reply from Corner &lt;Cafe&gt; (owner@corner.example.com) · Has a question\nAsks the price\n"How much?"')
    expect(calls.find((c) => c.url.includes('zapier'))!.body).toMatchObject({ source: 'lead-finder', event: 'reply', summary: 'Asks the price' })
  })
  it('says Meeting booked for bookings', () => {
    expect(alertText({ event: 'booked', lead: { name: 'Corner Cafe' } })).toBe('Meeting booked: Corner Cafe')
  })
  it('sends nothing when nothing is set up', async () => {
    expect(await sendAlert({ event: 'booked', lead: { name: 'X' } })).toEqual({ sent: [], failed: [] })
    expect(calls).toEqual([])
  })
})

describe('CRM sync', () => {
  it('upserts HubSpot contacts by email with a lead status, skipping leads without an email', async () => {
    process.env.HUBSPOT_TOKEN = 'pat-secret'
    const r = await syncCrm([lead, { name: 'No Email Co', status: 'new' }])
    expect(r).toEqual({ hubspot: { sent: 1, skipped: 1 } })
    expect(calls[0].url).toBe('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer pat-secret')
    expect(calls[0].body.inputs).toEqual([{
      idProperty: 'email', id: 'owner@corner.example.com',
      properties: { email: 'owner@corner.example.com', company: 'Corner Cafe', website: 'cornercafe.example.com', phone: '555-0100', city: 'Austin', hs_lead_status: 'CONNECTED' },
    }])
  })
  it('upserts GoHighLevel contacts with the version header, location and tags', async () => {
    process.env.GHL_TOKEN = 'ghl-secret'
    process.env.GHL_LOCATION_ID = 'loc123'
    expect(await syncCrm([lead, { name: 'Phone Only', phone: '555-0199', status: 'booked' }, { name: 'Nothing', status: 'new' }]))
      .toEqual({ ghl: { sent: 2, skipped: 1 } })
    expect(calls[0].url).toBe('https://services.leadconnectorhq.com/contacts/upsert')
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer ghl-secret', Version: '2021-07-28' })
    expect(calls[0].body).toMatchObject({ locationId: 'loc123', companyName: 'Corner Cafe', email: 'owner@corner.example.com', source: 'Lead Finder', tags: ['lead-finder', 'lead-finder-replied'] })
    expect(calls[1].body).toMatchObject({ phone: '555-0199', tags: ['lead-finder', 'lead-finder-booked'] })
  })
  it('turns a refused token into a fixed message without the token', async () => {
    process.env.HUBSPOT_TOKEN = 'pat-secret'
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"bad token pat-secret"}', { status: 401 })))
    const r = await syncCrm([lead])
    expect(r.hubspot?.error).toMatch(/refused the token/)
    expect(JSON.stringify(r)).not.toContain('pat-secret')
  })
  it('POST /api/crm needs a CRM set up and valid leads', async () => {
    expect((await crmPOST(req('crm', { leads: [lead] }))).status).toBe(400)
    process.env.HUBSPOT_TOKEN = 'pat-secret'
    expect((await crmPOST(req('crm', { leads: [] }))).status).toBe(400)
    expect((await crmPOST(req('crm', { leads: Array.from({ length: 26 }, () => lead) }))).status).toBe(400)
    const ok = await crmPOST(req('crm', { leads: [{ ...lead, status: 'weird', email: 'not an email' }] }))
    expect(await ok.json()).toEqual({ hubspot: { sent: 0, skipped: 1 } })
  })
  it('requires the access key when one is set', async () => {
    process.env.APP_ACCESS_KEY = 'k'
    process.env.HUBSPOT_TOKEN = 'pat-secret'
    expect((await crmPOST(req('crm', { leads: [lead] }))).status).toBe(401)
    expect((await notifyPOST(req('notify', { event: 'booked', lead: { name: 'X' } }))).status).toBe(401)
    expect((await integrationsGET(new Request('http://localhost/api/integrations'))).status).toBe(401)
    expect(calls).toEqual([])
  })
})
