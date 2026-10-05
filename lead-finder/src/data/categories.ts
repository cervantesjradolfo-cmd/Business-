// The business categories offered in the search form.
// `selectors` are OpenStreetMap (Overpass) tag filters. Add a category by adding an entry
// here and its id to CategoryId in src/lib/types.ts. "Any business" is computed from the rest.
import type { CategoryId } from '../lib/types.js'

export type CategoryDef = {
  id: CategoryId
  label: string
  singular: string
  selectors: string[]
  // Terms for the Nominatim fallback, tried in order as "<term> near <location>" (one request each).
  // Nominatim only understands OSM "special phrases" (not free text); each term was checked live.
  // An empty list means no phrase works, so the fallback cannot search this category.
  nominatimTerms: string[]
}

const SPECIFIC: CategoryDef[] = [
  { id: 'restaurants', label: 'Restaurants', singular: 'Restaurant', selectors: ['["amenity"~"^(restaurant|fast_food)$"]'], nominatimTerms: ['restaurant'] },
  { id: 'cafes', label: 'Cafes', singular: 'Cafe', selectors: ['["amenity"~"^(cafe|ice_cream)$"]'], nominatimTerms: ['cafe'] },
  { id: 'salons', label: 'Hair & beauty salons', singular: 'Hair salon', selectors: ['["shop"="beauty"]', '["shop"="hairdresser"]["hairdresser"!="barber"]'], nominatimTerms: ['hairdresser'] },
  { id: 'barbers', label: 'Barbers', singular: 'Barber', selectors: ['["shop"="hairdresser"]["hairdresser"="barber"]', '["shop"="hairdresser"]["name"~"barber",i]'], nominatimTerms: ['hairdresser'] },
  { id: 'auto_repair', label: 'Auto repair', singular: 'Auto repair shop', selectors: ['["shop"~"^(car_repair|tyres)$"]'], nominatimTerms: ['car repair'] },
  { id: 'dentists', label: 'Dentists', singular: 'Dentist', selectors: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], nominatimTerms: ['dentist'] },
  { id: 'fitness', label: 'Gyms & fitness', singular: 'Gym', selectors: ['["leisure"="fitness_centre"]', '["amenity"="dojo"]'], nominatimTerms: ['martial arts', 'sports centre'] },
  {
    id: 'trades',
    label: 'Contractors & trades',
    singular: 'Contractor',
    selectors: ['["craft"~"^(electrician|plumber|hvac|roofer|carpenter|painter|builder|tiler|glaziery|stonemason|gardener|floorer|plasterer|metal_construction|construction)$"]'],
    nominatimTerms: ['electrician', 'carpenter'],
  },
  { id: 'cleaning', label: 'Cleaning services', singular: 'Cleaning service', selectors: ['["shop"~"^(dry_cleaning|laundry)$"]', '["craft"="cleaning"]'], nominatimTerms: ['dry cleaning', 'laundry'] },
  { id: 'party_rentals', label: 'Party & event rentals', singular: 'Party rental', selectors: ['["shop"~"^(party|rental)$"]', '["amenity"="events_venue"]'], nominatimTerms: [] },
  {
    id: 'retail',
    label: 'Retail shops',
    singular: 'Shop',
    selectors: ['["shop"~"^(clothes|gift|boutique|shoes|jewelry|florist|furniture|books|toys|sports|hardware|pet|bicycle|variety_store|second_hand|electronics|cosmetics)$"]'],
    nominatimTerms: ['clothes shop', 'gift shop', 'shoe shop'],
  },
  { id: 'real_estate', label: 'Real estate', singular: 'Real estate agent', selectors: ['["office"="estate_agent"]'], nominatimTerms: ['estate agent'] },
  { id: 'law', label: 'Law offices', singular: 'Law office', selectors: ['["office"~"^(lawyer|notary)$"]'], nominatimTerms: [] },
  { id: 'medical', label: 'Medical clinics', singular: 'Medical clinic', selectors: ['["amenity"~"^(clinic|doctors)$"]', '["healthcare"~"^(physiotherapist|chiropractor)$"]'], nominatimTerms: ['clinic', 'doctors'] },
]

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'any',
    label: 'Any business',
    singular: 'Business',
    selectors: SPECIFIC.flatMap((c) => c.selectors),
    nominatimTerms: ['restaurant', 'cafe', 'hairdresser', 'car repair', 'dentist'],
  },
  ...SPECIFIC,
]

export function getCategory(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id)
}
