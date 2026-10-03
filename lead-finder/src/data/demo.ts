// Fictional demo businesses in a made-up town, used by "Explore demo data".
// Names, phone numbers (555) and websites (example.com) are fake. Safe to edit.
import type { AuditResult, Lead, SiteGapId } from '../lib/types'

const CHECKED = '2026-01-15T12:00:00.000Z'

function lead(n: number, p: Partial<Lead> & Pick<Lead, 'name' | 'category' | 'categoryId'>): Lead {
  return {
    id: `demo:${n}`,
    osmType: 'node',
    osmId: 9000000 + n,
    osmUrl: `https://www.openstreetmap.org/node/${9000000 + n}`,
    address: `${100 + n * 7} Sample Street, Sampleville`,
    city: 'Sampleville',
    lat: 40 + n * 0.001,
    lon: -100 + n * 0.001,
    distanceKm: Math.round(n * 37) / 100,
    isDemo: true,
    ...p,
  }
}

export const DEMO_LEADS: Lead[] = [
  lead(1, { name: 'Fakeville Family Dental', category: 'Dentist', categoryId: 'dentists', phone: '+1 555-0101', openingHours: 'Mo-Fr 08:00-17:00' }),
  lead(2, { name: 'Sample Street Barbers', category: 'Barber', categoryId: 'barbers', phone: '+1 555-0102' }),
  lead(3, { name: 'Pretend Pizza Palace', category: 'Restaurant', categoryId: 'restaurants', phone: '+1 555-0103', website: 'http://pretend-pizza.example.com', openingHours: 'Mo-Su 11:00-22:00' }),
  lead(4, { name: 'Example Auto Works', category: 'Auto repair shop', categoryId: 'auto_repair', website: 'www.example-autoworks.example.com', openingHours: 'Mo-Fr 07:30-18:00' }),
  lead(5, { name: 'Demo Beans Cafe', category: 'Cafe', categoryId: 'cafes', phone: '+1 555-0105', website: 'https://demobeans.example.com', openingHours: 'Mo-Su 06:30-15:00', email: 'hello@demobeans.example.com' }),
  lead(6, { name: 'Imaginary Iron Gym', category: 'Gym', categoryId: 'fitness', phone: '+1 555-0106', website: 'https://imaginary-iron.example.com' }),
  lead(7, { name: 'Notreal Roofing & Repair', category: 'Contractor', categoryId: 'trades', phone: '+1 555-0107' }),
  lead(8, { name: 'Sparkle Fake Cleaners', category: 'Cleaning service', categoryId: 'cleaning', phone: '+1 555-0108', website: 'https://sparkle-fake.example.com', openingHours: 'Mo-Sa 08:00-18:00' }),
  lead(9, { name: 'Bouncy Make-Believe Rentals', category: 'Party rental', categoryId: 'party_rentals', phone: '+1 555-0109', website: 'https://make-believe-rentals.example.com' }),
  lead(10, { name: 'Placeholder Law Group', category: 'Law office', categoryId: 'law', phone: '+1 555-0110', website: 'https://placeholder-law.example.com', openingHours: 'Mo-Fr 09:00-17:00' }),
  lead(11, { name: 'Mock Hair Studio', category: 'Hair salon', categoryId: 'salons', phone: '+1 555-0111', website: 'https://mockhair.example.com', openingHours: 'Tu-Sa 09:00-19:00' }),
  lead(12, { name: 'Testville Medical Clinic', category: 'Medical clinic', categoryId: 'medical', phone: '+1 555-0112', website: 'https://testville-clinic.example.com', openingHours: 'Mo-Fr 08:00-16:00' }),
]

function ok(n: number, gaps: SiteGapId[], detail: AuditResult['detail'] = {}, finalUrl?: string): AuditResult {
  return { id: `demo:${n}`, status: 'ok', finalUrl, httpStatus: 200, elapsedMs: 900, gaps, detail, checkedAt: CHECKED }
}

export const DEMO_AUDITS: Record<string, AuditResult> = {
  // 3: many gaps (old, insecure, slow)
  'demo:3': ok(3, ['no_https', 'no_mobile_viewport', 'no_online_booking', 'no_contact_form', 'no_chat_widget', 'outdated_copyright', 'slow_site', 'no_click_to_call'], { outdated_copyright: '© 2017', slow_site: '6.2 s' }, 'http://pretend-pizza.example.com/'),
  // 4: unreachable
  'demo:4': { id: 'demo:4', status: 'unreachable', gaps: [], note: 'Timed out after 8 s', checkedAt: CHECKED },
  // 5: almost no gaps
  'demo:5': ok(5, ['no_chat_widget'], {}, 'https://demobeans.example.com/'),
  // 6: limited
  'demo:6': { id: 'demo:6', status: 'limited', httpStatus: 403, gaps: [], note: 'Site blocked our automated check; review it by hand', checkedAt: CHECKED },
  'demo:8': ok(8, ['no_online_booking', 'no_chat_widget', 'no_social_links', 'missing_seo_tags'], { missing_seo_tags: 'No description' }, 'https://sparkle-fake.example.com/'),
  'demo:9': ok(9, ['no_mobile_viewport', 'no_online_booking', 'no_contact_form', 'outdated_copyright', 'no_click_to_call'], { outdated_copyright: '© 2019' }, 'https://make-believe-rentals.example.com/'),
  'demo:10': ok(10, ['no_chat_widget', 'no_social_links'], {}, 'https://placeholder-law.example.com/'),
  'demo:11': ok(11, ['no_online_booking', 'no_chat_widget'], {}, 'https://mockhair.example.com/'),
  'demo:12': ok(12, ['no_online_booking', 'no_chat_widget', 'missing_seo_tags', 'no_click_to_call'], { missing_seo_tags: 'No title or description' }, 'https://testville-clinic.example.com/'),
}
