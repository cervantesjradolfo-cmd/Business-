// ─────────────────────────────────────────────────────────────
//  EDIT ME: all the business info on the site lives in this file.
//  Change names, prices, phone numbers, etc. here and the whole
//  site updates. Images live in /public/images.
// ─────────────────────────────────────────────────────────────

export const business = {
  name: 'Bounce Kingdom',
  tagline: 'Party Rentals',
  phone: '(555) 123-4567',
  email: 'hello@bouncekingdom.com',
  serviceArea: 'Serving the greater metro area + 25 miles',
  hours: 'Mon–Sun · 8am–8pm',
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  // Where booking requests are sent. Create a free form at https://formspree.io
  // and paste its endpoint here (e.g. 'https://formspree.io/f/abcdwxyz').
  // Leave empty to open the visitor's email app instead.
  formEndpoint: '',
}

export const stats = [
  { value: 2500, suffix: '+', label: 'Parties bounced' },
  { value: 4.9, suffix: '★', label: 'Average rating', decimals: 1 },
  { value: 100, suffix: '%', label: 'Sanitized every rental' },
]

export type Category = 'Bounce Houses' | 'Water Slides' | 'Combos' | 'Obstacle Courses'

export type Rental = {
  id: string
  name: string
  category: Category
  price: number // per day
  image: string
  size: string
  ages: string
  capacity: string
  blurb: string
  tag?: string
  color: string // accent color for the card
}

export const rentals: Rental[] = [
  {
    id: 'castle',
    name: 'Royal Castle Bouncer',
    category: 'Bounce Houses',
    price: 159,
    image: 'images/castle.webp',
    size: '15 × 15 ft',
    ages: '3–12',
    capacity: '8 kids',
    blurb: 'The classic! Bright turrets, mesh windows so parents can peek in, and endless bouncing.',
    tag: 'Most booked',
    color: '#2563EB',
  },
  {
    id: 'princess',
    name: 'Princess Palace',
    category: 'Bounce Houses',
    price: 179,
    image: 'images/princess.webp',
    size: '15 × 15 ft',
    ages: '3–10',
    capacity: '8 kids',
    blurb: 'Pastel pinks and lavender turrets fit for royalty. A birthday-photo favorite.',
    color: '#EC4899',
  },
  {
    id: 'waterslide',
    name: 'Tidal Wave Slide',
    category: 'Water Slides',
    price: 289,
    image: 'images/waterslide.webp',
    size: '30 × 12 × 18 ft',
    ages: '5+',
    capacity: '3 at a time',
    blurb: 'An 18-foot drop into a splash pool. The ultimate way to beat the summer heat.',
    tag: 'Summer hit',
    color: '#0891B2',
  },
  {
    id: 'tropical',
    name: 'Tropical Paradise Slide',
    category: 'Water Slides',
    price: 319,
    image: 'images/tropical.webp',
    size: '32 × 14 × 20 ft',
    ages: '5+',
    capacity: '3 at a time',
    blurb: 'Palm trees, dual lanes and a big lagoon. Race your friends to the bottom.',
    color: '#16A34A',
  },
  {
    id: 'combo',
    name: 'Mega Combo 5-in-1',
    category: 'Combos',
    price: 249,
    image: 'images/combo.webp',
    size: '22 × 18 ft',
    ages: '3–14',
    capacity: '10 kids',
    blurb: 'Bounce area, climbing wall, slide, basketball hoop and pop-up obstacles all in one.',
    tag: 'Best value',
    color: '#9333EA',
  },
  {
    id: 'obstacle',
    name: 'Ninja Obstacle Course',
    category: 'Obstacle Courses',
    price: 369,
    image: 'images/obstacle.webp',
    size: '60 × 12 ft',
    ages: '5+',
    capacity: '2 racers',
    blurb: 'Side-by-side racing lanes with tunnels, pillars and a slide finish. Perfect for schools.',
    color: '#EA580C',
  },
]

export const addOns = [
  { id: 'generator', name: 'Quiet generator', price: 75, note: 'No outlet nearby? No problem.' },
  { id: 'tables', name: 'Table + 8 chairs', price: 25, note: 'Per set' },
  { id: 'cotton', name: 'Cotton candy machine', price: 65, note: 'Includes 50 servings' },
  { id: 'popcorn', name: 'Popcorn machine', price: 60, note: 'Includes 50 servings' },
  { id: 'attendant', name: 'Party attendant', price: 35, note: 'Per hour, trained staff' },
]

export const steps = [
  {
    title: 'Pick your fun',
    text: 'Browse rentals, add favorites to your quote and see your total instantly.',
  },
  {
    title: 'Reserve your date',
    text: 'Send a request. We confirm within 2 hours. No deposit until confirmed.',
  },
  {
    title: 'We deliver & set up',
    text: 'Our crew arrives early, sets up, safety-checks and takes it all away after.',
  },
]

export const testimonials = [
  {
    name: 'Jessica M.',
    event: "Son's 7th birthday",
    quote:
      'They showed up an hour early, the castle was spotless, and the kids did not stop jumping for 5 hours. Booking again next year!',
  },
  {
    name: 'Coach Ramirez',
    event: 'School field day',
    quote:
      'The ninja course was a massive hit with 300 students. Super professional crew and everything felt safe and well-anchored.',
  },
  {
    name: 'Tanya & Leo',
    event: 'Backyard summer bash',
    quote:
      'The water slide was the star of the party. Easy online quote, friendly texts, and zero stress on the day.',
  },
  {
    name: 'Pastor Dan',
    event: 'Church fall festival',
    quote:
      'We rented three inflatables and a cotton candy machine. Fair prices, on time, and great with the little ones.',
  },
]

export const faqs = [
  {
    q: 'How much space do I need?',
    a: 'Each rental lists its size. Add about 5 feet on every side for safety and the blower. We need a mostly flat area of grass, turf or concrete.',
  },
  {
    q: 'Do you deliver and set up?',
    a: 'Yes! Delivery, setup, safety check and pickup are free within our service area. We arrive 1–2 hours before your party starts.',
  },
  {
    q: 'What if it rains?',
    a: 'Safety first. If rain or high winds (15+ mph) are forecast, you can reschedule or cancel for a full refund up to the morning of your event.',
  },
  {
    q: 'Are the inflatables clean and safe?',
    a: 'Every unit is cleaned and sanitized after every rental, inspected before delivery, and staked or sandbagged down. We are fully insured.',
  },
  {
    q: 'How long is a rental?',
    a: 'Standard rentals are for the whole day (up to 8 hours). Overnight and multi-day rates are available, just ask!',
  },
  {
    q: 'Do I need to pay a deposit?',
    a: 'Nothing is due until we confirm your date. Then a small deposit holds your reservation and the balance is due on delivery.',
  },
]

export const gallery = [
  { src: 'images/party.webp', alt: 'Backyard birthday party with a colorful bounce house and balloons', span: 'md:col-span-2 md:row-span-2' },
  { src: 'images/event.webp', alt: 'Community festival with several inflatables set up in a park', span: 'md:col-span-2' },
  { src: 'images/setup.webp', alt: 'Delivery crew setting up a bounce house on a lawn', span: '' },
  { src: 'images/hero.webp', alt: 'Castle bounce house at a sunny backyard party', span: '' },
]
