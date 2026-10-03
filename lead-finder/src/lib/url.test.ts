import { describe, expect, it } from 'vitest'
import { isBlockedHostname, isPrivateIp, normalizeWebsite } from './url'

describe('normalizeWebsite', () => {
  it('bare domain tries https then http', () => {
    expect(normalizeWebsite('www.x.com')).toEqual(['https://www.x.com', 'http://www.x.com'])
    expect(normalizeWebsite('x.com/')).toEqual(['https://x.com/', 'http://x.com/'])
  })
  it('http tries https first', () => {
    expect(normalizeWebsite('http://x.com')).toEqual(['https://x.com', 'http://x.com'])
  })
  it('https as given', () => {
    expect(normalizeWebsite('https://x.com')).toEqual(['https://x.com'])
  })
  it('takes the first of several values', () => {
    expect(normalizeWebsite('https://x.com; https://y.com')).toEqual(['https://x.com'])
  })
  it('keeps facebook-style values', () => {
    expect(normalizeWebsite('facebook.com/page')).toEqual(['https://facebook.com/page', 'http://facebook.com/page'])
  })
  it('rejects junk', () => {
    for (const j of ['', '   ', 'junk', 'ftp://x.com', 'mailto:a@b.com', 'javascript:alert(1)', 'hello world.com', 'localhost'])
      expect(normalizeWebsite(j)).toBeNull()
  })
})

describe('isPrivateIp', () => {
  it('flags private IPv4', () => {
    for (const ip of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1'])
      expect(isPrivateIp(ip)).toBe(true)
  })
  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '172.32.0.1', '100.128.0.1', '1.1.1.1', '192.169.0.1']) expect(isPrivateIp(ip)).toBe(false)
  })
  it('flags private IPv6 and mapped IPv4', () => {
    for (const ip of ['::', '::1', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe'])
      expect(isPrivateIp(ip)).toBe(true)
  })
  it('allows public IPv6', () => {
    for (const ip of ['2606:4700::1111', '::ffff:8.8.8.8', '2001:4860:4860::8888']) expect(isPrivateIp(ip)).toBe(false)
  })
})

describe('isPrivateIp (reviewer ranges)', () => {
  it('flags IPv4-compatible, NAT64, 6to4, SIIT and site-local IPv6', () => {
    for (const ip of ['::7f00:1', '::127.0.0.1', '::a00:1', '64:ff9b::7f00:1', '64:ff9b::127.0.0.1', '64:ff9b::a9fe:a9fe', '64:ff9b:1::1', '2002:7f00:1::', '2002:a9fe:a9fe::1', '::ffff:0:7f00:1', 'fec0::1', 'feff::1', 'ff02::1', 'ff00::', '2001:0:4136:e378:8000:63bf:3fff:fdd2'])
      expect(isPrivateIp(ip), ip).toBe(true)
  })
  it('allows IPv6 that embeds a public IPv4', () => {
    for (const ip of ['64:ff9b::808:808', '2002:808:808::1', '::ffff:0:808:808', '2a00:1450:4001::1'])
      expect(isPrivateIp(ip), ip).toBe(false)
  })
  it('treats unparseable IPv6 as private', () => {
    for (const ip of ['::g', '1:2:3:4:5:6:7:8:9', '1::2::3', 'zzzz::1']) expect(isPrivateIp(ip), ip).toBe(true)
  })
  it('flags benchmarking, IETF protocol, multicast, reserved and broadcast IPv4', () => {
    for (const ip of ['198.18.0.1', '198.19.255.255', '192.0.0.1', '192.0.0.255', '224.0.0.1', '239.255.255.255', '240.0.0.1', '250.1.2.3', '255.255.255.255'])
      expect(isPrivateIp(ip), ip).toBe(true)
  })
  it('keeps neighbouring public IPv4 ranges open', () => {
    for (const ip of ['198.17.255.255', '198.20.0.1', '192.0.1.1', '223.255.255.255']) expect(isPrivateIp(ip), ip).toBe(false)
  })
})

describe('isBlockedHostname bracketed IPv6', () => {
  it('blocks the normalised forms of IPv4-compatible literals', () => {
    expect(new URL('http://[::127.0.0.1]/').hostname).toBe('[::7f00:1]')
    expect(isBlockedHostname(new URL('http://[::127.0.0.1]/').hostname)).toBe(true)
    expect(isBlockedHostname('[64:ff9b::7f00:1]')).toBe(true)
    expect(isBlockedHostname('[2002:7f00:1::]')).toBe(true)
  })
})

describe('isBlockedHostname', () => {
  it('blocks local names and IP literals', () => {
    for (const h of ['localhost', 'a.localhost', 'printer.local', 'db.internal', '127.0.0.1', '[::1]', '10.0.0.5', '2130706433', 'LOCALHOST.'])
      expect(isBlockedHostname(h)).toBe(true)
  })
  it('allows public names', () => {
    for (const h of ['example.com', '8.8.8.8', 'sub.example.org']) expect(isBlockedHostname(h)).toBe(false)
  })
})
