import { describe, expect, it } from 'vitest'
import { contactPageLinks, decodeCfEmail, extractEmails } from './emails'

const SITE = 'https://www.cornercafe.example.com/'

describe('extractEmails', () => {
  it('finds mailto links and plain-text addresses, own domain and generic inboxes first', () => {
    const html = `<a href="mailto:Pat.Smith@gmail.com?subject=Hi">Pat</a>
      <p>Write to info@cornercafe.example.com or bookings@cornercafe.example.com.</p>`
    expect(extractEmails(html, SITE)).toEqual(['info@cornercafe.example.com', 'bookings@cornercafe.example.com', 'pat.smith@gmail.com'])
  })
  it('decodes entities, percent-encoding, [at]/[dot] and Cloudflare protection', () => {
    expect(extractEmails('<a href="mailto:hello%40cornercafe.example.com">x</a>', SITE)).toEqual(['hello@cornercafe.example.com'])
    expect(extractEmails('<p>office&#64;cornercafe.example.com</p>', SITE)).toEqual(['office@cornercafe.example.com'])
    expect(extractEmails('<p>contact [at] cornercafe [dot] example [dot] com</p>', SITE)).toEqual(['contact@cornercafe.example.com'])
    // "a@b.co" XOR-encoded with key 0x42
    const key = 0x42
    const hex = key.toString(16) + [...'a@b.co'].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('')
    expect(decodeCfEmail(hex)).toBe('a@b.co')
    expect(extractEmails(`<span class="__cf_email__" data-cfemail="${hex}">[email&#160;protected]</span>`, SITE)).toEqual(['a@b.co'])
  })
  it('skips image names, trackers, site-builder and placeholder addresses', () => {
    const html = `<img src="logo@2x.png"> abc123def456abc789@sentry.io  user@wixpress.com  your@email.com  name@domain.com
      noreply@cornercafe.example.com  you@example.com`
    expect(extractEmails(html, SITE)).toEqual([])
  })
  it('returns at most three', () => {
    const html = ['a', 'b', 'c', 'd'].map((x) => `${x}@cornercafe.example.com`).join(' ')
    expect(extractEmails(html, SITE)).toHaveLength(3)
  })
})

describe('contactPageLinks', () => {
  it('picks same-site contact pages first, then about pages, and ignores other sites', () => {
    const html = `<a href="/about-us">About</a><a href="https://facebook.com/contact">FB</a>
      <a href="/menu">Menu</a><a href="contact.html">Get in touch</a><a href="/contact.html#form">again</a>`
    expect(contactPageLinks(html, SITE)).toEqual(['https://www.cornercafe.example.com/contact.html', 'https://www.cornercafe.example.com/about-us'])
  })
  it('matches on the link text too', () => {
    expect(contactPageLinks('<a href="/p/12"><span>Contact us</span></a>', SITE)).toEqual(['https://www.cornercafe.example.com/p/12'])
  })
})
