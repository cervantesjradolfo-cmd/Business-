// Edit these prices to match yours.
// One entry per service Lead Finder can recommend. The "estimated deal value" on each
// lead is the sum of min and max (USD) over its recommended services.
import type { ServiceId } from '../lib/types.js'

export const PRICING: Record<ServiceId, { label: string; description: string; min: number; max: number }> = {
  website: {
    label: 'Website',
    description: 'A fast, modern, mobile-friendly website with their hours, services and contact details.',
    min: 1500,
    max: 5000,
  },
  online_booking: {
    label: 'Online booking',
    description: 'Let customers book or request appointments any time, with optional deposits.',
    min: 500,
    max: 1500,
  },
  ai_chat: {
    label: 'AI chat assistant',
    description: 'A chat assistant that answers common questions and captures leads around the clock.',
    min: 750,
    max: 2500,
  },
  mobile_redesign: {
    label: 'Mobile redesign',
    description: 'Refresh an outdated or slow site so it works well on phones.',
    min: 1000,
    max: 3000,
  },
  seo_basics: {
    label: 'SEO basics',
    description: 'Page titles, descriptions and complete map listings so people can find them.',
    min: 300,
    max: 1000,
  },
  review_collection: {
    label: 'Review collection',
    description: 'Automatically ask happy customers for reviews and link social profiles.',
    min: 300,
    max: 800,
  },
}
