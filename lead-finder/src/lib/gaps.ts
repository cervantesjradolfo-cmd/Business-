// What Lead Finder looks for on a business, in plain words, with weights and the services
// each gap suggests. Edit labels, weights and pitch phrases here.
import type { GapId, Lead, ServiceId, SiteGapId } from './types.js'

export type GapDef = {
  id: GapId
  label: string
  weight: number
  services: ServiceId[]
  phrase: string // for pitches, lower-case, no business name
}

export const GAP_DEFS: Record<GapId, GapDef> = {
  no_website: { id: 'no_website', label: 'No website', weight: 70, services: ['website', 'online_booking', 'review_collection'], phrase: "you don't have a website customers can find" },
  site_unreachable: { id: 'site_unreachable', label: 'Website is down or broken', weight: 55, services: ['website'], phrase: "your website isn't loading right now" },
  no_mobile_viewport: { id: 'no_mobile_viewport', label: 'Not mobile-friendly', weight: 20, services: ['mobile_redesign'], phrase: "your website doesn't display well on phones" },
  no_https: { id: 'no_https', label: "Website isn't secure (no HTTPS)", weight: 15, services: ['website'], phrase: 'your website shows a "not secure" warning in browsers' },
  no_online_booking: { id: 'no_online_booking', label: 'No online booking', weight: 15, services: ['online_booking'], phrase: "there's no way to book online" },
  slow_site: { id: 'slow_site', label: 'Website is very slow', weight: 10, services: ['mobile_redesign'], phrase: 'your website is slow to load' },
  outdated_copyright: { id: 'outdated_copyright', label: 'Website looks outdated', weight: 10, services: ['mobile_redesign'], phrase: "your website looks like it hasn't been updated in a while" },
  no_contact_form: { id: 'no_contact_form', label: 'No contact form on homepage', weight: 8, services: ['ai_chat'], phrase: "there's no contact form on your homepage" },
  no_chat_widget: { id: 'no_chat_widget', label: 'No chat on website', weight: 8, services: ['ai_chat'], phrase: "there's no chat to answer visitors' questions" },
  missing_seo_tags: { id: 'missing_seo_tags', label: 'Missing page title or description (SEO)', weight: 8, services: ['seo_basics'], phrase: 'your website is missing the title or description Google shows in search' },
  no_phone_listed: { id: 'no_phone_listed', label: 'No phone number on map listing', weight: 6, services: ['seo_basics'], phrase: 'your map listing has no phone number' },
  no_click_to_call: { id: 'no_click_to_call', label: 'No tap-to-call phone link', weight: 6, services: ['mobile_redesign'], phrase: "your phone number isn't tap-to-call on mobile" },
  no_social_links: { id: 'no_social_links', label: 'No social media links', weight: 5, services: ['review_collection'], phrase: "your website doesn't link to any social media pages" },
  no_hours_listed: { id: 'no_hours_listed', label: 'No opening hours on map listing', weight: 4, services: ['seo_basics'], phrase: "your map listing doesn't show opening hours" },
}

export const BOOKING_PROVIDERS = [
  'calendly.com', 'acuityscheduling.com', 'squareup.com/appointments', 'square.site', 'booksy.com', 'vagaro.com',
  'mindbodyonline.com', 'opentable.com', 'resy.com', 'exploretock.com', 'sevenrooms.com', 'setmore.com', 'simplybook',
  'fresha.com', 'schedulicity.com', 'styleseat.com', 'housecallpro.com', 'getjobber.com', 'zocdoc.com', 'nexhealth.com',
  'appointy.com', 'youcanbook.me', 'glossgenius.com', 'booker.com', 'picktime.com',
]
export const FORM_PROVIDERS = [
  'jotform', 'typeform.com', 'formspree.io', 'wufoo.com', 'hsforms', 'docs.google.com/forms', 'wpforms', 'wpcf7',
  'gform_', 'forms.office.com', 'tally.so', '123formbuilder',
]
export const CHAT_PROVIDERS = [
  'intercom', 'driftt.com', 'tawk.to', 'crisp.chat', 'livechatinc.com', 'zdassets.com', 'zopim', 'tidio', 'usemessages.com',
  'js.hs-scripts.com', 'olark', 'freshchat', 'podium.com', 'birdeye.com', 'smith.ai', 'botpress', 'chatbase.co', 'manychat',
  'customerchat', 'gorgias', 'liveperson', 'ada.cx', 'userlike', 'purechat', 'chatra', 'jivosite', 'smartsupp',
  'kommunicate', 'landbot.io', 'leadconnectorhq',
]
export const SOCIAL_DOMAINS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com/', 'linkedin.com', 'tiktok.com', 'youtube.com', 'yelp.com',
  'pinterest.com', 'nextdoor.com',
]

export type SiteFetchInfo = { finalUrl: string; elapsedMs: number; now: Date }

const BOOKING_PHRASES =
  /\b(book (now|online|an appointment|a table|your)|schedule (now|online|an appointment|a service|your)|make a reservation|reserve (now|a table|online)|request an appointment)\b/i

export function detectSiteGaps(
  html: string,
  info: SiteFetchInfo,
): { gaps: SiteGapId[]; detail: Partial<Record<SiteGapId, string>> } {
  const gaps: SiteGapId[] = []
  const detail: Partial<Record<SiteGapId, string>> = {}
  const lower = html.toLowerCase()
  const hasAny = (list: string[]) => list.some((p) => lower.includes(p))

  if (!/^https:/i.test(info.finalUrl)) gaps.push('no_https')

  const metas = html.match(/<meta\b[^>]*>/gi) ?? []
  if (!metas.some((m) => /\bname\s*=\s*["']?viewport\b/i.test(m))) gaps.push('no_mobile_viewport')

  if (!hasAny(BOOKING_PROVIDERS) && !BOOKING_PHRASES.test(html)) gaps.push('no_online_booking')

  const forms = [...html.matchAll(/<form\b([\s\S]*?)(?:<\/form>|$)/gi)].map((m) => m[1])
  const formOk = forms.some((f) => /<textarea/i.test(f) || /type\s*=\s*["']?email/i.test(f))
  if (!formOk && !hasAny(FORM_PROVIDERS)) gaps.push('no_contact_form')

  if (!hasAny(CHAT_PROVIDERS)) gaps.push('no_chat_widget')

  const hrefs = [...html.matchAll(/href\s*=\s*["']?([^"'\s>]*)/gi)].map((m) => m[1].toLowerCase())
  if (!hrefs.some((h) => SOCIAL_DOMAINS.some((d) => h.includes(d)))) gaps.push('no_social_links')

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim()
  const descTag = metas.find((m) => /\bname\s*=\s*["']?description\b/i.test(m))
  const desc = descTag ? /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(descTag) : null
  const descText = (desc?.[1] ?? desc?.[2] ?? desc?.[3] ?? '').trim()
  if (!title || !descText) {
    gaps.push('missing_seo_tags')
    detail.missing_seo_tags = !title && !descText ? 'No title or description' : !title ? 'No title' : 'No description'
  }

  let maxYear = 0
  for (const m of html.matchAll(/(?:©|&copy;|&#169;|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})/gi)) {
    const y = Number(m[1])
    if (y >= 1990 && y > maxYear) maxYear = y
  }
  if (maxYear && maxYear <= info.now.getFullYear() - 3) {
    gaps.push('outdated_copyright')
    detail.outdated_copyright = `© ${maxYear}`
  }

  if (info.elapsedMs > 4000) {
    gaps.push('slow_site')
    detail.slow_site = `${(info.elapsedMs / 1000).toFixed(1)} s`
  }

  if (!/href\s*=\s*["']?tel:/i.test(html)) gaps.push('no_click_to_call')

  return { gaps, detail }
}

export function listingGaps(lead: Pick<Lead, 'website' | 'phone' | 'openingHours'>): GapId[] {
  const gaps: GapId[] = []
  if (!lead.website?.trim()) gaps.push('no_website')
  if (!lead.phone?.trim()) gaps.push('no_phone_listed')
  if (!lead.openingHours?.trim()) gaps.push('no_hours_listed')
  return gaps
}
