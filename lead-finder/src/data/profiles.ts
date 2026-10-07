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
    sender: { name: '', business: 'Asher Construction', email: '', phone: '', address: '', website: '' },
  },
]
