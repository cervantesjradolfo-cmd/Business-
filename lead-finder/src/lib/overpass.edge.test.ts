import { describe, expect, it } from 'vitest'
import { OVERPASS_MIRRORS, parseOverpassUrls, parseRetryAfter } from './overpass'

describe('parseOverpassUrls edge cases', () => {
  const d = [...OVERPASS_MIRRORS]
  it('defaults for unset, blank, commas, http, garbage, other schemes', () => {
    for (const v of [undefined, '', '  ', ',, ,', 'http://a.example/x', 'garbage', 'ftp://a.example', 'javascript:alert(1)', '//a.example/x']) {
      expect(parseOverpassUrls(v)).toEqual(d)
    }
  })
  it('returns a fresh array, not the constant', () => {
    expect(parseOverpassUrls(undefined)).not.toBe(OVERPASS_MIRRORS)
  })
  it('trims, drops invalid, dedupes keeping first, caps at 6', () => {
    expect(parseOverpassUrls('  https://a.example/i ,x, http://b.example/i,https://a.example/i,https://c.example/i')).toEqual(['https://a.example/i', 'https://c.example/i'])
    const many = Array.from({ length: 9 }, (_, i) => `https://h${i}.example/i`).join(',')
    expect(parseOverpassUrls(many)).toEqual(Array.from({ length: 6 }, (_, i) => `https://h${i}.example/i`))
  })
  it('drops loopback, private, link-local, localhost, .internal, numeric and credentialed hosts', () => {
    const bad = [
      'https://localhost/api',
      'https://127.0.0.1/api',
      'https://169.254.169.254/latest',
      'https://10.0.0.5/api',
      'https://192.168.1.2/api',
      'https://172.16.0.1/api',
      'https://[::1]/api',
      'https://foo.internal/api',
      'https://2130706433/',
      'https://user:pw@good.example/api',
    ]
    for (const b of bad) expect(parseOverpassUrls(b)).toEqual(d)
    expect(parseOverpassUrls(bad.join(','))).toEqual(d)
    expect(parseOverpassUrls([...bad, 'https://ok.example/api'].join(','))).toEqual(['https://ok.example/api'])
  })
  it('drops encoded and aliased bypass forms of internal hosts', () => {
    const bad = [
      'https://2130706433/', // decimal
      'https://0x7f000001/', // hex
      'https://0x7f.0.0.1/', // partial hex
      'https://017700000001/', // octal
      'https://0177.0.0.1/', // dotted octal
      'https://127.1/', // short form
      'https://0.0.0.0/',
      'https://[::ffff:127.0.0.1]/', // IPv4-mapped loopback
      'https://[::ffff:7f00:1]/',
      'https://[::ffff:10.0.0.1]/',
      'https://[::ffff:169.254.169.254]/',
      'https://[::]/',
      'https://[fe80::1]/',
      'https://[fd00::1]/',
      'https://LOCALHOST/api',
      'https://LocalHost:8443/api',
      'https://localhost./api',
      'https://127.0.0.1./api',
      'https://sub.localhost/api',
      'https://printer.local/api',
      'https://PRINTER.LOCAL./api',
      'https://metadata.google.internal/api',
      'https://user:@good.example/api', // userinfo with empty password
      'https://:pw@good.example/api',
    ]
    for (const b of bad) expect(parseOverpassUrls(b), b).toEqual(d)
    expect(parseOverpassUrls([...bad, 'https://ok.example/api'].join(','))).toEqual(['https://ok.example/api'])
  })
  it('dedupes before capping', () => {
    const raw = ['https://a.example/i', 'https://a.example/i', ...Array.from({ length: 6 }, (_, i) => `https://h${i}.example/i`)].join(',')
    expect(parseOverpassUrls(raw)).toHaveLength(6)
    expect(parseOverpassUrls(raw)[1]).toBe('https://h0.example/i')
  })
})

describe('parseRetryAfter edge cases', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  it('seconds, zero, whitespace, huge', () => {
    expect(parseRetryAfter('2', now)).toBe(2000)
    expect(parseRetryAfter('0', now)).toBe(0)
    expect(parseRetryAfter(' 5 ', now)).toBe(5000)
    expect(parseRetryAfter('999999', now)).toBe(999_999_000)
  })
  it('negative, decimal and junk are null', () => {
    for (const v of ['-3', '1.5', '', '   ', 'abc', null, '1e3']) expect(parseRetryAfter(v, now)).toBeNull()
  })
  it('HTTP dates: future, past, now', () => {
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:07 GMT', now)).toBe(7000)
    expect(parseRetryAfter('Wed, 31 Dec 2025 23:00:00 GMT', now)).toBe(0)
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0)
  })
})
