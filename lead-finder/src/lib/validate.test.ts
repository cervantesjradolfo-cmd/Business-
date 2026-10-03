import { describe, expect, it } from 'vitest'
import { parseAuditRequest, parsePitchRequest, parseSearchRequest } from './validate'

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
