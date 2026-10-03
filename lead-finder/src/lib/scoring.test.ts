import { describe, expect, it } from 'vitest'
import { PRICING } from '../data/pricing'
import { dealValue, recommendServices, scoreLead, scoreTier } from './scoring'
import type { AuditResult, Lead } from './types'

const base: Lead = {
  id: 'osm:node/1', osmType: 'node', osmId: 1, osmUrl: '', name: 'X', category: 'Cafe', categoryId: 'cafes',
  address: '', lat: 0, lon: 0, distanceKm: 1, phone: '1', openingHours: 'x',
}
const audit = (o: Partial<AuditResult>): AuditResult => ({ id: base.id, status: 'ok', gaps: [], checkedAt: '', ...o })

describe('scoreLead', () => {
  it('no website outscores a site with minor gaps', () => {
    const none = scoreLead(base)
    const minor = scoreLead({ ...base, website: 'a.com' }, audit({ gaps: ['no_chat_widget', 'no_social_links'] }))
    expect(none.score).toBe(70)
    expect(minor.score).toBe(13)
    expect(none.score).toBeGreaterThan(minor.score)
    expect(none.auditState).toBe('none')
  })
  it('caps at 100', () => {
    const s = scoreLead({ ...base, phone: undefined, openingHours: undefined }, undefined)
    expect(s.score).toBe(80)
    const big = scoreLead({ ...base, website: 'a.com', phone: undefined }, audit({ status: 'unreachable', note: 'HTTP 500' }))
    expect(big.score).toBe(61)
    const many = scoreLead({ ...base, website: 'a.com', phone: undefined, openingHours: undefined }, audit({ status: 'unreachable' }))
    expect(many.score).toBeLessThanOrEqual(100)
    const huge = scoreLead(
      { ...base, website: 'a.com', phone: undefined, openingHours: undefined },
      audit({ gaps: ['no_https', 'no_mobile_viewport', 'no_online_booking', 'no_contact_form', 'no_chat_widget', 'no_social_links', 'missing_seo_tags', 'outdated_copyright', 'slow_site', 'no_click_to_call'] }),
    )
    expect(huge.score).toBe(100)
  })
  it('attaches details, sorts gaps and tracks audit state', () => {
    const s = scoreLead({ ...base, website: 'a.com' }, audit({ gaps: ['no_chat_widget', 'outdated_copyright'], detail: { outdated_copyright: '© 2019' } }))
    expect(s.gaps.map((g) => g.id)).toEqual(['outdated_copyright', 'no_chat_widget'])
    expect(s.gaps[0].detail).toBe('© 2019')
    expect(scoreLead({ ...base, website: 'a.com' }, undefined, true).auditState).toBe('pending')
    expect(scoreLead({ ...base, website: 'a.com' }).auditState).toBe('done')
    const un = scoreLead({ ...base, website: 'a.com' }, audit({ status: 'unreachable', note: 'Timed out after 8 s' }))
    expect(un.gaps[0]).toMatchObject({ id: 'site_unreachable', detail: 'Timed out after 8 s' })
  })
  it('zero gaps gives score 0 and no deal', () => {
    const s = scoreLead({ ...base, website: 'a.com' }, audit({}))
    expect(s.score).toBe(0)
    expect(s.services).toEqual([])
    expect(s.dealValue).toEqual({ min: 0, max: 0 })
  })
})

describe('services and deal value', () => {
  it('dedupes and drops mobile_redesign when website is present', () => {
    expect(recommendServices(['no_website', 'no_mobile_viewport', 'no_online_booking'])).toEqual(['website', 'online_booking', 'review_collection'])
    expect(recommendServices(['no_mobile_viewport', 'slow_site', 'no_chat_widget'])).toEqual(['mobile_redesign', 'ai_chat'])
  })
  it('sums PRICING', () => {
    const d = dealValue(['website', 'ai_chat'])
    expect(d).toEqual({ min: PRICING.website.min + PRICING.ai_chat.min, max: PRICING.website.max + PRICING.ai_chat.max })
    expect(dealValue([])).toEqual({ min: 0, max: 0 })
  })
  it('tiers', () => {
    expect([scoreTier(70), scoreTier(69), scoreTier(40), scoreTier(39)]).toEqual(['hot', 'warm', 'warm', 'cool'])
  })
})
