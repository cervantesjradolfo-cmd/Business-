// Client profiles that exist the first time the app opens. After that, profiles are edited in the
// app (Profile details) and kept in the browser, so changing this file does not change them.
import type { ClientProfile } from '../lib/types.js'

export const DEFAULT_PROFILES: ClientProfile[] = [
  {
    id: 'asher-construction',
    label: 'Asher Construction',
    offer: 'drywall, metal framing and acoustic ceilings',
    sellingPoints: '',
    categories: ['general_contractors', 'property_managers', 'architects'],
    // Words looked for in Chicago building-permit descriptions (the Projects search).
    projectKeywords: [
      'DRYWALL', 'FRAMING', 'ACOUSTIC', 'CEILING', 'PARTITION', 'BUILD-OUT', 'BUILDOUT', 'BUILD OUT',
      'INTERIOR ALTERATION', 'INTERIOR RENOVATION', 'GUT REHAB', 'NEW CONSTRUCTION',
    ],
    sender: { name: '', business: 'Asher Construction', email: '', phone: '', address: '', website: '' },
  },
]
