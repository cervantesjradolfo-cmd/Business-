// Website value normalisation and SSRF helpers (pure, no network).

export function normalizeWebsite(raw: string): string[] | null {
  let value = (raw ?? '').split(';')[0].trim()
  if (!value || /\s/.test(value)) return null
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value)
  let candidates: string[]
  if (scheme) {
    const s = scheme[1].toLowerCase()
    if (s === 'https') candidates = [value]
    else if (s === 'http') candidates = ['https://' + value.slice(scheme[0].length), value]
    else return null
  } else {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/]*\.[^/]*:\d+/.test(value)) return null // mailto:, tel:, javascript:
    value = value.replace(/^\/+/, '')
    candidates = [`https://${value}`, `http://${value}`]
  }
  const out: string[] = []
  for (const c of candidates) {
    try {
      const u = new URL(c)
      if (!u.hostname.includes('.')) return null
      out.push(c)
    } catch {
      return null
    }
  }
  return out
}

function parseIpv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  return parts.every((n) => n <= 255) ? parts : null
}

// Expands an IPv6 string into 8 16-bit groups (null if it is not valid IPv6).
function parseIpv6(s: string): number[] | null {
  let str = s
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(str)
  if (tail) {
    const v4 = parseIpv4(tail[1])
    if (!v4) return null
    str = str.slice(0, tail.index) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16)
  }
  const halves = str.split('::')
  if (halves.length > 2) return null
  const toGroups = (h: string) => (h === '' ? [] : h.split(':'))
  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest]
  if (all.length !== 8) return null
  const out: number[] = []
  for (const g of all) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

const v4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`

export function isPrivateIp(ip: string): boolean {
  let s = ip.trim().toLowerCase()
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
  const zone = s.indexOf('%')
  if (zone >= 0) s = s.slice(0, zone)
  if (s.includes(':')) {
    const g = parseIpv6(s)
    if (!g) return true // not parseable: be safe
    const firstFiveZero = g.slice(0, 5).every((x) => x === 0)
    // IPv4-mapped ::ffff:a.b.c.d
    if (firstFiveZero && g[5] === 0xffff) return isPrivateIp(v4From(g[6], g[7]))
    // ::/80 (unspecified, loopback, IPv4-compatible such as ::7f00:1)
    if (firstFiveZero) return true
    // IPv4-translated ::ffff:0:a.b.c.d
    if (g.slice(0, 4).every((x) => x === 0) && g[4] === 0xffff && g[5] === 0) return isPrivateIp(v4From(g[6], g[7]))
    // NAT64 64:ff9b::/96 (embedded IPv4) and 64:ff9b:1::/48 (local use)
    if (g[0] === 0x64 && g[1] === 0xff9b) {
      if (g[2] === 1) return true
      if (g.slice(2, 6).every((x) => x === 0)) return isPrivateIp(v4From(g[6], g[7]))
    }
    // 6to4 2002::/16 embeds the IPv4 in bits 16-48
    if (g[0] === 0x2002) return isPrivateIp(v4From(g[1], g[2]))
    // Teredo 2001::/32
    if (g[0] === 0x2001 && g[1] === 0) return true
    if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7
    if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10
    if ((g[0] & 0xffc0) === 0xfec0) return true // fec0::/10 (site-local)
    if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
    return false
  }
  const v4 = parseIpv4(s)
  if (!v4) return true // not an IP: caller should not have asked; be safe
  const [a, b, c] = v4
  if (a === 0 || a === 10 || a === 127) return true
  if (a >= 224) return true // multicast, reserved, broadcast
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && c === 0) return true // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15
  return false
}

export function isBlockedHostname(hostname: string): boolean {
  let h = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (h.includes(':')) return isPrivateIp(h)
  if (/^\d+(\.\d+){3}$/.test(h)) return isPrivateIp(h)
  // Numeric/hex single-number hosts like 2130706433 or 0x7f000001
  if (/^(0x[0-9a-f]+|\d+)$/.test(h)) return true
  return false
}
