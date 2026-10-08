import { describe, expect, it } from 'vitest'
import { cleanKeywords, isEmail, parseAuditRequest, parseFollowUpRequest, parsePitchRequest, parseProjectsRequest, parseSearchRequest, parseSendRequest } from './validate'

describe('parseSearchRequest', () => {
  it('applies defaults and trims', () => {
    expect(parseSearchRequest({ location: '  Austin ', category: 'cafes' })).toEqual({ ok: true, value: { location: 'Austin', category: 'cafes', radiusKm: 5, limit: 60 } })
  })
  it('clamps and rounds', () => {
    const r = parseSearchRequest({ location: 'x', category: 'any', radiusKm: 99, limit: 0.4 })
    expect(r.ok && r.value).toMatchObject({ radiusKm: 25, limit: 1 })
    const r2 = parseSearchRequest({ location: 'x', category: 'any', radiusKm: 'abc', limit: 500.6 })
    expect(r2.ok && r2.value).toMatchObject({ radiusKm: 5, limit: 200 })
    const r3 = parseSearchRequest({ location: 'x', category: 'any', radiusKm: 0, limit: NaN })
    expect(r3.ok && r3.value).toMatchObject({ radiusKm: 1, limit: 60 })
  })
  it('caps the location at 200 chars', () => {
    const r = parseSearchRequest({ location: 'a'.repeat(300), category: 'any' })
    expect(r.ok && r.value.location.length).toBe(200)
  })
  it('errors', () => {
    expect(parseSearchRequest({ location: '   ', category: 'any' })).toEqual({ ok: false, error: 'Enter a city, ZIP code or address' })
    expect(parseSearchRequest({ location: 'x', category: 'nope' })).toEqual({ ok: false, error: 'Unknown category' })
    expect(parseSearchRequest(null).ok).toBe(false)
  })
})

describe('parseAuditRequest', () => {
  it('accepts 1..10 items', () => {
    expect(parseAuditRequest({ leads: [{ id: 'a', website: 'x.com' }] }).ok).toBe(true)
    expect(parseAuditRequest({ leads: [] }).ok).toBe(false)
    expect(parseAuditRequest({ leads: Array.from({ length: 11 }, () => ({ id: 'a', website: 'x' })) }).ok).toBe(false)
  })
  it('validates types and length', () => {
    expect(parseAuditRequest({ leads: [{ id: 1, website: 'x' }] }).ok).toBe(false)
    expect(parseAuditRequest({ leads: [{ id: 'a', website: 'x'.repeat(501) }] }).ok).toBe(false)
  })
})

describe('parsePitchRequest', () => {
  it('requires a name', () => {
    expect(parsePitchRequest({ lead: { name: '' } }).ok).toBe(false)
    expect(parsePitchRequest({ lead: { name: 'x'.repeat(201) } }).ok).toBe(false)
    expect(parsePitchRequest({}).ok).toBe(false)
  })
  it('filters unknown ids and fills sender', () => {
    const r = parsePitchRequest({ lead: { name: 'A', city: 5 }, gaps: ['no_website', 'bogus'], services: ['website', 'x'], sender: { name: 'S' } })
    expect(r.ok && r.value.gaps).toEqual(['no_website'])
    expect(r.ok && r.value.services).toEqual(['website'])
    expect(r.ok && r.value.sender).toEqual({ name: 'S', business: '', email: '', phone: '', address: '', website: '' })
    expect(r.ok && r.value.lead.city).toBeUndefined()
  })
})

describe('parsePitchRequest offer', () => {
  const base = { lead: { name: 'Summit' }, gaps: [], services: [], sender: {} }
  it('keeps a client offer, trimmed and capped', () => {
    const r = parsePitchRequest({ ...base, offer: { services: '  drywall  ', sellingPoints: 'x'.repeat(600) } })
    expect(r.ok && r.value.offer).toEqual({ services: 'drywall', sellingPoints: 'x'.repeat(500) })
  })
  it('drops empty selling points and leaves the offer out when not sent', () => {
    const r = parsePitchRequest({ ...base, offer: { services: 'drywall', sellingPoints: '  ' } })
    expect(r.ok && r.value.offer).toEqual({ services: 'drywall' })
    const none = parsePitchRequest(base)
    expect(none.ok && 'offer' in none.value).toBe(false)
  })
})

describe('parseProjectsRequest', () => {
  it('cleans keywords so nothing but plain words reaches the query', () => {
    const r = parseProjectsRequest({ location: ' Chicago ', keywords: ['drywall', "x' OR 1=1 --", 'build-out', 'Drywall', 'ab', '50%'], days: 999, radiusKm: 0, limit: 500 })
    expect(r.ok && r.value).toEqual({ location: 'Chicago', keywords: ['DRYWALL', 'X OR 1 1 --', 'BUILD-OUT'], radiusKm: 1, days: 180, limit: 200 })
  })
  it('needs a location and at least one keyword', () => {
    expect(parseProjectsRequest({ keywords: ['drywall'] }).ok).toBe(false)
    expect(parseProjectsRequest({ location: 'Chicago', keywords: ["'", 'ab'] })).toEqual({ ok: false, error: 'Add the kinds of work to look for in Profile details' })
  })
  it('accepts a comma-separated string', () => {
    expect(cleanKeywords('drywall, interior alteration ,  ')).toEqual(['DRYWALL', 'INTERIOR ALTERATION'])
  })
})

describe('isEmail', () => {
  it('accepts plain addresses and rejects odd ones', () => {
    expect(isEmail(' info@acme.example.com ')).toBe(true)
    expect(isEmail('a.b+c@acme.co')).toBe(true)
    for (const bad of ['', 'no-at.com', 'a@b', 'a b@c.com', '<a@b.com>', 'a@b.com,c@d.com', 'a@b.com\nBcc: x@y.com', 'a@@b.com', `${'a'.repeat(250)}@b.com`]) {
      expect(isEmail(bad)).toBe(false)
    }
  })
})

describe('parseSendRequest', () => {
  const good = {
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true, user: 'me@gmail.com', pass: 'app-pass-1234' },
    from: { name: 'Sam', address: 'Me@Gmail.com' },
    to: 'owner@acme.example.com', subject: 'Hello', text: 'Body', suppressed: [' A@B.com ', 5, 'c@d.com'],
  }
  it('accepts a good request and normalises the suppression list', () => {
    const r = parseSendRequest(good)
    expect(r.ok && r.value).toMatchObject({ to: 'owner@acme.example.com', suppressed: ['a@b.com', 'c@d.com'], from: { address: 'Me@Gmail.com' } })
  })
  it('checks the port and secure combination', () => {
    expect(parseSendRequest({ ...good, smtp: { ...good.smtp, port: 25 } }).ok).toBe(false)
    expect(parseSendRequest({ ...good, smtp: { ...good.smtp, secure: false } })).toEqual({ ok: false, error: 'Port 465 uses SSL; 587 and 2525 use STARTTLS' })
    expect(parseSendRequest({ ...good, smtp: { ...good.smtp, port: 587, secure: false } }).ok).toBe(true)
    expect(parseSendRequest({ ...good, smtp: { ...good.smtp, port: 587, secure: true } }).ok).toBe(false)
  })
  it('rejects header injection, bad hosts, bad addresses and oversized input', () => {
    expect(parseSendRequest({ ...good, subject: 'Hi\r\nBcc: x@y.com' }).ok).toBe(false)
    expect(parseSendRequest({ ...good, from: { name: 'A\nB', address: 'a@b.com' } }).ok).toBe(false)
    expect(parseSendRequest({ ...good, smtp: { ...good.smtp, host: 'a b.com' } }).ok).toBe(false)
    expect(parseSendRequest({ ...good, to: 'nope' }).ok).toBe(false)
    expect(parseSendRequest({ ...good, text: '' }).ok).toBe(false)
    expect(parseSendRequest({ ...good, text: 'x'.repeat(20001) }).ok).toBe(false)
    expect(parseSendRequest({ ...good, inReplyTo: 'no-brackets' }).ok).toBe(false)
    expect(parseSendRequest({ ...good, suppressed: new Array(5001).fill('a@b.com') })).toEqual({ ok: false, error: 'Suppression list too long' })
    expect(parseSendRequest(null).ok).toBe(false)
  })
  it('accepts a message id for replies', () => {
    const r = parseSendRequest({ ...good, inReplyTo: '<abc@gmail.com>' })
    expect(r.ok && r.value.inReplyTo).toBe('<abc@gmail.com>')
  })
  it('never puts submitted values in the error', () => {
    const r = parseSendRequest({ ...good, smtp: { ...good.smtp, pass: '' }, to: 'secret-recipient' })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('secret')
    const r2 = parseSendRequest({ ...good, smtp: { ...good.smtp, host: 'bad host!' } })
    expect(JSON.stringify(r2)).not.toContain('bad host')
  })
})

describe('parseFollowUpRequest', () => {
  const ok = { lead: { name: ' Summit ' }, sender: { name: 'Asher', business: 'Asher Co' }, step: 2, previousSubject: 'S', previousBody: ' Hi there ' }
  it('accepts steps 1 and 2 and trims and caps fields', () => {
    const r = parseFollowUpRequest({ ...ok, previousBody: 'x'.repeat(6000), offer: { services: 'drywall', sellingPoints: ' ' }, project: { address: '1 Main', issued: '2026-10-06' } })
    expect(r.ok && r.value).toEqual({
      lead: { name: 'Summit', category: 'business', city: undefined },
      sender: { name: 'Asher', business: 'Asher Co' },
      step: 2, previousSubject: 'S', previousBody: 'x'.repeat(5000),
      offer: { services: 'drywall' },
      project: { address: '1 Main', description: '', issued: '2026-10-06' },
    })
  })
  it('refuses a missing name, a bad step or no earlier email', () => {
    expect(parseFollowUpRequest({ ...ok, lead: {} })).toEqual({ ok: false, error: 'Business name is required' })
    expect(parseFollowUpRequest({ ...ok, step: 0 })).toEqual({ ok: false, error: 'Invalid follow-up step' })
    expect(parseFollowUpRequest({ ...ok, step: 3 }).ok).toBe(false)
    expect(parseFollowUpRequest({ ...ok, previousBody: '  ' })).toEqual({ ok: false, error: 'The earlier email is required' })
    expect(parseFollowUpRequest(null).ok).toBe(false)
  })
})
