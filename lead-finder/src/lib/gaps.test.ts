import { describe, expect, it } from 'vitest'
import { detectSiteGaps, listingGaps } from './gaps'

const now = new Date('2026-06-01T00:00:00Z')
const info = { finalUrl: 'https://x.com/', elapsedMs: 500, now }
const GOOD = `<html><head><title>Hi</title><meta name="description" content="d"><meta name="viewport" content="width=device-width"></head>
<body><a href="tel:+15550100">call</a><a href="https://facebook.com/x">fb</a><a href="https://calendly.com/x">Book</a>
<form><textarea></textarea></form><script src="https://embed.tawk.to/x"></script>© 2026</body></html>`
const gaps = (html: string, i = info) => detectSiteGaps(html, i).gaps

describe('detectSiteGaps', () => {
  it('finds nothing wrong on a good page', () => {
    expect(gaps(GOOD)).toEqual([])
  })
  it('no_https', () => {
    expect(gaps(GOOD, { ...info, finalUrl: 'http://x.com' })).toEqual(['no_https'])
  })
  it('viewport in either attribute order and quoting', () => {
    expect(gaps(GOOD.replace(/<meta name="viewport"[^>]*>/, '<meta content="width=device-width" name=viewport>'))).toEqual([])
    expect(gaps(GOOD.replace(/<meta name="viewport"[^>]*>/, ''))).toEqual(['no_mobile_viewport'])
  })
  it('booking by provider or phrase', () => {
    expect(gaps(GOOD.replace('calendly.com', 'x.com'))).toContain('no_online_booking')
    expect(gaps(GOOD.replace('calendly.com', 'x.com').replace('>Book<', '>Book online<'))).not.toContain('no_online_booking')
  })
  it('contact form', () => {
    expect(gaps(GOOD.replace('<textarea></textarea>', ''))).toEqual(['no_contact_form'])
    expect(gaps(GOOD.replace('<textarea></textarea>', '<input type=email>'))).toEqual([])
    expect(gaps(GOOD.replace('<form><textarea></textarea></form>', '<div class="jotform"></div>'))).toEqual([])
  })
  it('chat widget', () => {
    expect(gaps(GOOD.replace('tawk.to', 'x.io'))).toEqual(['no_chat_widget'])
  })
  it('social links', () => {
    expect(gaps(GOOD.replace('facebook.com', 'example.org'))).toEqual(['no_social_links'])
  })
  it('seo tags with details', () => {
    expect(detectSiteGaps(GOOD.replace('<title>Hi</title>', '<title> </title>'), info).detail.missing_seo_tags).toBe('No title')
    expect(detectSiteGaps(GOOD.replace('content="d"', 'content=""'), info).detail.missing_seo_tags).toBe('No description')
    expect(detectSiteGaps('<html></html>', info).detail.missing_seo_tags).toBe('No title or description')
  })
  it('copyright: old year, range, no year, young year', () => {
    expect(detectSiteGaps(GOOD.replace('© 2026', '© 2019'), info).detail.outdated_copyright).toBe('© 2019')
    expect(detectSiteGaps(GOOD.replace('© 2026', 'Copyright 2015 - 2020'), info).detail.outdated_copyright).toBe('© 2020')
    expect(gaps(GOOD.replace('© 2026', ''))).toEqual([])
    expect(gaps(GOOD.replace('© 2026', '&copy; 2023'))).toEqual(['outdated_copyright'])
    expect(gaps(GOOD.replace('© 2026', '© 2024'))).toEqual([])
    expect(gaps(GOOD.replace('© 2026', '© 1985'))).toEqual([])
  })
  it('slow site', () => {
    const r = detectSiteGaps(GOOD, { ...info, elapsedMs: 6200 })
    expect(r.gaps).toEqual(['slow_site'])
    expect(r.detail.slow_site).toBe('6.2 s')
    expect(gaps(GOOD, { ...info, elapsedMs: 4000 })).toEqual([])
  })
  it('tap to call', () => {
    expect(gaps(GOOD.replace('href="tel:+15550100"', 'href="#"'))).toEqual(['no_click_to_call'])
  })
})

describe('listingGaps', () => {
  it('flags missing website, phone and hours', () => {
    expect(listingGaps({})).toEqual(['no_website', 'no_phone_listed', 'no_hours_listed'])
    expect(listingGaps({ website: 'a.com', phone: '1', openingHours: 'x' })).toEqual([])
    expect(listingGaps({ website: '  ', phone: '1', openingHours: 'x' })).toEqual(['no_website'])
  })
})
