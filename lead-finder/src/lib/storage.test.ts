import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PROFILES } from '../data/profiles'
import { loadProfiles, loadSaved, mailboxKey, newProfileId, outreachKey, savedKey } from './storage'

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { window.localStorage.clear() })

describe('client profile storage', () => {
  it('starts with the default profiles, but keeps an emptied list empty', () => {
    expect(loadProfiles()).toEqual(DEFAULT_PROFILES)
    expect(DEFAULT_PROFILES[0]).toMatchObject({ id: 'asher-construction', categories: ['general_contractors', 'property_managers', 'architects'] })
    window.localStorage.setItem('leadfinder:profiles', '[]')
    expect(loadProfiles()).toEqual([])
  })
  it('drops broken entries, duplicate ids and unknown categories, and fills missing fields', () => {
    window.localStorage.setItem('leadfinder:profiles', JSON.stringify([
      null, { label: 'no id' }, { id: 'a', label: ' ', categories: ['architects', 'any', 'nope', 3], sender: 'x' },
      { id: 'a', label: 'dupe' },
    ]))
    expect(loadProfiles()).toEqual([{
      id: 'a', label: 'Client', offer: '', sellingPoints: '', categories: ['architects'], projectKeywords: [],
      sender: { name: '', business: '', email: '', phone: '', address: '', website: '' },
    }])
    window.localStorage.setItem('leadfinder:profiles', '{not json')
    expect(loadProfiles()).toEqual(DEFAULT_PROFILES)
  })
  it('makes readable, unique ids', () => {
    expect(newProfileId('Bright Roofing & Co.', [])).toBe('bright-roofing-co')
    expect(newProfileId('Asher Construction', ['asher-construction', 'asher-construction-2'])).toBe('asher-construction-3')
    expect(newProfileId('!!!', [])).toBe('client')
  })
  it('keeps each profile’s saved leads under its own key', () => {
    expect(savedKey()).toBe('leadfinder:saved')
    expect(savedKey('asher-construction')).toBe('leadfinder:saved:asher-construction')
    const lead = { id: 'osm:node/1', name: 'Ridge' }
    window.localStorage.setItem(savedKey('asher-construction'), JSON.stringify({ 'osm:node/1': { lead, status: 'won' } }))
    expect(loadSaved(savedKey('asher-construction'))['osm:node/1'].status).toBe('won')
    expect(loadSaved()).toEqual({})
  })
  it('keeps outreachEmail only when it is a string', () => {
    const lead = { id: 'osm:node/1', name: 'Ridge' }
    window.localStorage.setItem('leadfinder:saved', JSON.stringify({
      a: { lead, outreachEmail: 'x@ridge.example.com' },
      b: { lead: { ...lead, id: 'b' }, outreachEmail: 5 },
    }))
    const out = loadSaved()
    expect(out.a.outreachEmail).toBe('x@ridge.example.com')
    expect(out.b.outreachEmail).toBeUndefined()
  })
  it('keys outreach and mailbox per profile', () => {
    expect(outreachKey()).toBe('leadfinder:outreach')
    expect(outreachKey('asher')).toBe('leadfinder:outreach:asher')
    expect(mailboxKey()).toBe('leadfinder:mailbox')
    expect(mailboxKey('asher')).toBe('leadfinder:mailbox:asher')
  })
})
