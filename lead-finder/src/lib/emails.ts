// Finds a business's email addresses in its own web pages: mailto links, plain text, and
// Cloudflare-protected addresses. Pure helpers, used by the website audit on the server.
import { isEmail } from './validate.js'

const TEXT_RE = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}/g
// Addresses that sit in page code but are not the business: error trackers and site builders (any subdomain),
// and placeholder domains (exact).
const TRACKER_DOMAINS = /(^|\.)(sentry\.io|wixpress\.com|wix\.com|godaddy\.com|squarespace\.com|schema\.org|w3\.org)$/i
const PLACEHOLDER_DOMAINS = /^(example\.(com|org|net)|domain\.com|email\.com|yourdomain\.com|yoursite\.com|mysite\.com|test\.com|company\.com)$/i
const JUNK_LOCAL = /^(name|email|your\.?name|yourname|you|user|username|first\.?last|firstname\.?lastname|john\.?doe|jane\.?doe|test|noreply|no-reply|donotreply|do-not-reply)$/i
const FILE_TLD = /\.(png|jpe?g|gif|webp|svg|avif|css|js|ico|bmp|tiff?)$/i
// Inboxes a business reads for new enquiries, best first.
const GENERIC_LOCAL = ['info', 'contact', 'hello', 'office', 'sales', 'admin', 'service', 'support', 'team', 'mail', 'enquiries', 'inquiries', 'bookings', 'booking', 'appointments']

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(commat|#64);/gi, '@')
    .replace(/&period;/gi, '.')
    .replace(/&amp;/gi, '&')
}

// Cloudflare's email obfuscation: hex string, first byte is the XOR key.
export function decodeCfEmail(hex: string): string {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2) return ''
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  return out
}

const clean = (raw: string): string => {
  let s = raw.trim().toLowerCase()
  try {
    s = decodeURIComponent(s)
  } catch {
    // keep as is
  }
  return s.replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '').trim()
}

function usable(email: string): boolean {
  if (!isEmail(email) || email.length > 100) return false
  const [local, domain] = email.split('@')
  if (FILE_TLD.test(email) || /@\d+x\./.test(email)) return false
  if (TRACKER_DOMAINS.test(domain) || PLACEHOLDER_DOMAINS.test(domain) || JUNK_LOCAL.test(local)) return false
  if (/^[0-9a-f]{16,}$/.test(local)) return false // tracking ids
  return true
}

const hostOf = (site: string): string => {
  try {
    return new URL(site).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

// The addresses on a page, best first: on the site's own domain, then generic inboxes, then the rest.
export function extractEmails(html: string, siteUrl: string, max = 3): string[] {
  const found = new Set<string>()
  const text = decodeEntities(html)
  for (const m of text.matchAll(/href\s*=\s*["']\s*mailto:([^"'>\s]+)/gi)) found.add(clean(m[1]))
  for (const m of text.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi)) found.add(clean(decodeCfEmail(m[1])))
  for (const m of text.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) found.add(clean(decodeCfEmail(m[1])))
  // "name [at] domain [dot] com"
  const deobfuscated = text.replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.')
  for (const m of deobfuscated.replace(/<[^>]*>/g, ' ').matchAll(TEXT_RE)) found.add(clean(m[0]))

  const host = hostOf(siteUrl)
  const rank = (e: string): number => {
    const [local, domain] = e.split('@')
    const own = host && (domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`))
    const generic = GENERIC_LOCAL.indexOf(local)
    return (own ? 0 : 100) + (generic >= 0 ? generic : 50)
  }
  return [...found].filter(usable).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, max)
}

// Same-site links that probably lead to contact details, best first.
export function contactPageLinks(html: string, pageUrl: string, max = 2): string[] {
  let base: URL
  try {
    base = new URL(pageUrl)
  } catch {
    return []
  }
  const scored: { url: string; score: number }[] = []
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    let u: URL
    try {
      u = new URL(decodeEntities(m[1]), base)
    } catch {
      continue
    }
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '') || !/^https?:$/.test(u.protocol)) continue
    const hay = `${u.pathname} ${m[2].replace(/<[^>]*>/g, ' ')}`.toLowerCase()
    const score = /contact/.test(hay) ? 0 : /about|team|get-in-touch|reach/.test(hay) ? 1 : -1
    if (score < 0) continue
    u.hash = ''
    if (u.toString() === base.toString() || scored.some((s) => s.url === u.toString())) continue
    scored.push({ url: u.toString(), score })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, max).map((s) => s.url)
}
