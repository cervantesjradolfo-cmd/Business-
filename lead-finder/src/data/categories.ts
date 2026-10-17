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
  // Extra selectors used only to recognise a business as this category, never sent to Overpass
  // (matching on name over a whole area is too slow there).
  nameSelectors?: string[]
  // Words searched by name with Nominatim inside the search area, alongside Overpass. Results are
  // kept only when they match this category. Also used when Overpass is down.
  nameSearchTerms?: string[]
}

// Niches where no big software platform bundles an AI receptionist yet (research report
// "Underserved AI niches for agencies", Oct 2026). Listed first so their more specific labels win
// (a towing shop tagged car_repair is labelled towing, a dojo martial arts, a banquet hall a venue).
// Many of these trades have little OpenStreetMap tagging, so they are also found by name; the name
// searches were checked live on Nominatim (Chicago, Oct 2026). Coverage is thin for garage doors,
// fencing, concrete, septic and tree service: expect a few results per town, not dozens.
const named = (keys: string[], words: string) => keys.map((k) => `["${k}"~"."]["name"~"${words}",i]`)
export const NICHES: CategoryDef[] = [
  {
    id: 'garage_doors', label: 'Garage door repair', singular: 'Garage door company',
    selectors: ['["shop"~"^(doors|garage_doors)$"]["name"~"garage",i]', '["craft"~"^(garage_door|door_construction)$"]'],
    nameSelectors: named(['shop', 'craft', 'office'], 'garage door'),
    nameSearchTerms: ['garage door'],
    nominatimTerms: [],
  },
  {
    id: 'fencing', label: 'Fence contractors', singular: 'Fence contractor',
    selectors: ['["craft"~"^(fence_maker|fencer|fence_builder)$"]', '["shop"="fence"]'],
    nameSelectors: named(['shop', 'craft', 'office'], 'fence|fencing'),
    nameSearchTerms: ['fence'],
    nominatimTerms: [],
  },
  {
    id: 'concrete', label: 'Concrete, flatwork & epoxy floors', singular: 'Concrete contractor',
    selectors: ['["craft"~"^(concrete|paver|concrete_contractor)$"]'],
    nameSelectors: named(['craft', 'office', 'shop'], 'concrete|epoxy|flatwork|paving stone'),
    nameSearchTerms: ['concrete', 'epoxy'],
    nominatimTerms: [],
  },
  {
    id: 'septic_well', label: 'Septic & well services', singular: 'Septic & well service',
    selectors: ['["craft"~"^(septic|septic_tank|well_driller|well_drilling)$"]'],
    nameSelectors: named(['craft', 'office', 'shop'], 'septic|well drilling|well service|well pump'),
    nameSearchTerms: ['septic', 'well drilling'],
    nominatimTerms: [],
  },
  {
    id: 'tree_service', label: 'Tree service', singular: 'Tree service',
    selectors: ['["craft"~"^(arborist|tree_surgeon|tree_service)$"]', '["craft"="gardener"]["name"~"tree",i]'],
    nameSelectors: named(['craft', 'office', 'shop'], 'tree service|tree care|tree expert|tree removal|arborist|stump'),
    nameSearchTerms: ['tree service', 'tree removal'],
    nominatimTerms: [],
  },
  {
    id: 'locksmiths', label: 'Locksmiths', singular: 'Locksmith',
    selectors: ['["shop"="locksmith"]', '["craft"="locksmith"]'],
    nameSearchTerms: ['locksmith'],
    nominatimTerms: ['locksmith'],
  },
  {
    id: 'towing', label: 'Towing', singular: 'Towing company',
    selectors: ['["office"="towing"]', '["service"="towing"]', '["shop"="car_repair"]["name"~"towing",i]'],
    nameSelectors: named(['office', 'shop', 'craft'], 'towing|wrecker'),
    nameSearchTerms: ['towing'],
    nominatimTerms: [],
  },
  {
    id: 'junk_removal', label: 'Junk removal', singular: 'Junk removal company',
    selectors: ['["craft"="junk_removal"]', '["office"="moving_company"]["name"~"junk|haul",i]'],
    nameSelectors: named(['craft', 'office', 'shop'], 'junk|hauling'),
    nameSearchTerms: ['junk'],
    nominatimTerms: [],
  },
  {
    id: 'glass', label: 'Glass & glazing', singular: 'Glass company',
    selectors: ['["craft"~"^(glaziery|window_construction)$"]', '["shop"="glaziery"]'],
    nameSelectors: named(['craft', 'office', 'shop'], 'glass|glazing'),
    nominatimTerms: [],
  },
  {
    id: 'party_rentals', label: 'Party & event rentals', singular: 'Party rental',
    selectors: ['["shop"~"^(party|rental)$"]'],
    nameSelectors: named(['shop', 'craft', 'office'], 'party rental|tent rental|bounce|inflatable|jump'),
    nameSearchTerms: ['tent rental', 'party rental', 'bounce'],
    nominatimTerms: [],
  },
  {
    id: 'wedding_venues', label: 'Wedding & event venues', singular: 'Event venue',
    selectors: ['["amenity"="events_venue"]'],
    nameSelectors: named(['amenity'], 'banquet|wedding|reception hall|event (hall|center|venue)'),
    nameSearchTerms: ['banquet'],
    nominatimTerms: [],
  },
  {
    id: 'martial_arts_dance', label: 'Martial arts & dance studios', singular: 'Studio',
    selectors: ['["amenity"="dojo"]', '["leisure"="dance"]', '["amenity"="dancing_school"]'],
    nominatimTerms: ['dojo', 'dance school'],
  },
  {
    id: 'funeral_homes', label: 'Funeral homes', singular: 'Funeral home',
    selectors: ['["shop"="funeral_directors"]', '["amenity"="funeral_hall"]'],
    nominatimTerms: ['funeral directors'],
  },
  {
    id: 'daycare', label: 'Daycare & preschools', singular: 'Daycare',
    selectors: ['["amenity"="childcare"]', '["amenity"="kindergarten"]'],
    nominatimTerms: ['kindergarten', 'childcare'],
  },
  {
    id: 'photographers', label: 'Photographers', singular: 'Photographer',
    selectors: ['["craft"="photographer"]', '["shop"="photo_studio"]'],
    nominatimTerms: ['photographer'],
  },
  {
    id: 'self_storage', label: 'Self storage', singular: 'Self storage',
    selectors: ['["shop"="storage_rental"]'],
    nameSearchTerms: ['self storage'],
    nominatimTerms: [],
  },
]

// Starred in the category list until you change them.
export const DEFAULT_FAVORITES: CategoryId[] = NICHES.map((c) => c.id)

const SPECIFIC: CategoryDef[] = [
  ...NICHES,
  { id: 'restaurants', label: 'Restaurants', singular: 'Restaurant', selectors: ['["amenity"~"^(restaurant|fast_food)$"]'], nominatimTerms: ['restaurant'] },
  { id: 'cafes', label: 'Cafes', singular: 'Cafe', selectors: ['["amenity"~"^(cafe|ice_cream)$"]'], nominatimTerms: ['cafe'] },
  { id: 'salons', label: 'Hair & beauty salons', singular: 'Hair salon', selectors: ['["shop"="beauty"]', '["shop"="hairdresser"]["hairdresser"!="barber"]'], nominatimTerms: ['hairdresser'] },
  { id: 'barbers', label: 'Barbers', singular: 'Barber', selectors: ['["shop"="hairdresser"]["hairdresser"="barber"]', '["shop"="hairdresser"]["name"~"barber",i]'], nominatimTerms: ['hairdresser'] },
  { id: 'auto_repair', label: 'Auto repair', singular: 'Auto repair shop', selectors: ['["shop"~"^(car_repair|tyres)$"]'], nominatimTerms: ['car repair'] },
  { id: 'dentists', label: 'Dentists', singular: 'Dentist', selectors: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], nominatimTerms: ['dentist'] },
  { id: 'fitness', label: 'Gyms & fitness', singular: 'Gym', selectors: ['["leisure"="fitness_centre"]', '["amenity"="dojo"]'], nominatimTerms: ['martial arts', 'sports centre'] },
  // Listed before trades so plasterers are labelled as drywall. Many drywall firms are tagged only
  // as a generic company/office, so they are found by name: in Denver the tag query found 2, the
  // name search 5 more. No Nominatim phrase works ("plasterer near X" etc. return nothing), and
  // "framing" is not searched by name because it returns picture framers.
  {
    id: 'drywall',
    label: 'Drywall, ceilings & framing',
    singular: 'Drywall & ceiling contractor',
    selectors: ['["craft"~"^(drywall|drywall_contractor|plasterer|ceiling|insulation|framing|dry_lining)$"]'],
    nameSelectors: ['["craft"~"."]["name"~"drywall|acoustic|ceiling|framing",i]', '["office"~"."]["name"~"drywall|acoustic|ceiling|framing",i]'],
    nameSearchTerms: ['drywall', 'acoustic', 'ceiling', 'insulation'],
    nominatimTerms: [],
  },
  // Before trades so builders are labelled as general contractors. Builders tagged only as a
  // generic company are found by name. "construction" is not searched by name: it returns
  // construction sites. "contractors" is not used either: it returns electricians and roofers.
  {
    id: 'general_contractors',
    label: 'General contractors & builders',
    singular: 'General contractor',
    selectors: ['["office"~"^(construction_company|contractor|construction)$"]', '["craft"~"^(builder|construction)$"]'],
    nameSelectors: ['["office"~"."]["name"~"construction|builders|general contract",i]'],
    nameSearchTerms: ['builders', 'general contractor'],
    nominatimTerms: [],
  },
  {
    id: 'trades',
    label: 'Contractors & trades',
    singular: 'Contractor',
    selectors: ['["craft"~"^(electrician|plumber|hvac|roofer|carpenter|painter|builder|tiler|glaziery|stonemason|gardener|floorer|plasterer|metal_construction|construction)$"]'],
    nominatimTerms: ['electrician', 'carpenter'],
  },
  { id: 'cleaning', label: 'Cleaning services', singular: 'Cleaning service', selectors: ['["shop"~"^(dry_cleaning|laundry)$"]', '["craft"="cleaning"]'], nominatimTerms: ['dry cleaning', 'laundry'] },
  {
    id: 'retail',
    label: 'Retail shops',
    singular: 'Shop',
    selectors: ['["shop"~"^(clothes|gift|boutique|shoes|jewelry|florist|furniture|books|toys|sports|hardware|pet|bicycle|variety_store|second_hand|electronics|cosmetics)$"]'],
    nominatimTerms: ['clothes shop', 'gift shop', 'shoe shop'],
  },
  { id: 'real_estate', label: 'Real estate', singular: 'Real estate agent', selectors: ['["office"="estate_agent"]'], nominatimTerms: ['estate agent'] },
  {
    id: 'property_managers',
    label: 'Property managers',
    singular: 'Property manager',
    selectors: ['["office"="property_management"]'],
    nameSelectors: ['["office"~"."]["name"~"property management|property managers",i]'],
    nameSearchTerms: ['property management'],
    nominatimTerms: [],
  },
  {
    id: 'architects',
    label: 'Architects',
    singular: 'Architect',
    selectors: ['["office"="architect"]'],
    nameSelectors: ['["office"~"."]["name"~"architect",i]'],
    nameSearchTerms: ['architects'],
    nominatimTerms: [],
  },
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
