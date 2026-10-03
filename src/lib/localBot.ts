import { addOns, business, faqs, rentals, type Category } from '../data/site'

// Offline answers used when no AI backend is reachable (e.g. a plain static
// host with no /api/chat). Matches keywords against the data in site.ts.

// Matches at the start of a word, so "all" doesn't fire on "small"
const has = (text: string, ...words: string[]) =>
  words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text))

const rentalLine = (r: (typeof rentals)[number]) =>
  `- ${r.name}: $${r.price}/day, ${r.size}, ages ${r.ages}`

const listCategory = (cat: Category) => rentals.filter((r) => r.category === cat).map(rentalLine)

function faq(index: number) {
  return faqs[index]?.a ?? ''
}

export function localReply(input: string): string {
  const t = input.toLowerCase()

  // A specific rental by name or id
  const generic = new Set(['slide', 'bouncer', 'course', 'combo', 'obstacle'])
  const named = rentals.find((r) =>
    r.name
      .toLowerCase()
      .split(' ')
      .some((w) => w.length > 4 && !generic.has(w) && has(t, w)),
  )
  if (named && !has(t, 'all', 'list', 'options')) {
    return `${named.name} is $${named.price}/day. It's ${named.size}, for ages ${named.ages}, and fits ${named.capacity}. ${named.blurb}`
  }

  if (has(t, 'water', 'wet', 'splash', 'summer', 'pool')) {
    return `Our water slides:\n${listCategory('Water Slides').join('\n')}\nYou'll need a garden hose nearby. Want me to add one to your quote?`
  }
  if (has(t, 'obstacle', 'ninja', 'race', 'school', 'field day')) {
    return `For schools and big groups, the Ninja Obstacle Course is the crowd favorite:\n${listCategory('Obstacle Courses').join('\n')}`
  }
  if (has(t, 'combo', 'slide and', 'climb', 'basketball', 'best value')) {
    return `The Mega Combo 5-in-1 has a bounce area, climbing wall, slide and hoop:\n${listCategory('Combos').join('\n')}`
  }
  if (has(t, 'toddler', 'little', 'young', 'princess', 'castle', 'bounce house', 'bouncer', 'age')) {
    return `For younger kids, our bounce houses are perfect:\n${listCategory('Bounce Houses').join('\n')}`
  }
  if (has(t, 'add-on', 'addon', 'extra', 'generator', 'table', 'chair', 'cotton', 'popcorn', 'attendant')) {
    return `Party add-ons:\n${addOns.map((a) => `- ${a.name}: $${a.price} (${a.note})`).join('\n')}`
  }
  if (has(t, 'price', 'cost', 'how much', 'cheap', 'budget', 'rate', 'rent', 'option', 'what do you', 'list', 'all')) {
    return `Here's everything (per day, free delivery and setup):\n${rentals.map(rentalLine).join('\n')}`
  }
  if (has(t, 'space', 'room', 'yard', 'fit', 'size', 'big')) return faq(0)
  if (has(t, 'deliver', 'setup', 'set up', 'pick up', 'pickup', 'area', 'where', 'travel', 'far'))
    return `${faq(1)} ${business.serviceArea}.`
  if (has(t, 'rain', 'weather', 'wind', 'cancel', 'refund', 'resched')) return faq(2)
  if (has(t, 'clean', 'safe', 'insur', 'sanit')) return faq(3)
  if (has(t, 'long', 'hours', 'overnight', 'multi', 'all day', 'duration')) return faq(4)
  if (has(t, 'deposit', 'pay', 'payment', 'card', 'cash')) return faq(5)
  if (has(t, 'book', 'reserve', 'available', 'availability', 'date', 'quote')) {
    return `Add the rentals you like to your quote, then send the booking form in the Book section below. We confirm within 2 hours, and nothing is due until your date is confirmed.`
  }
  if (has(t, 'phone', 'call', 'text', 'email', 'contact', 'human', 'person', 'talk'))
    return `You can reach us at ${business.phone} (call or text) or ${business.email}. We're open ${business.hours}.`
  if (/^(hi|hello|hey|howdy)\b/.test(t.trim()))
    return `Hi there! I can help you pick a rental, check prices, or explain how booking works. What are you planning?`
  if (has(t, 'thank'))
    return `You're welcome! Anything else I can help with?`

  return `I'm not sure about that one. Try asking about prices, water slides, space needed, or how booking works. For anything else, call or text ${business.phone}.`
}
