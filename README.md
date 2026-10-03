# Bounce Kingdom: bounce house rental website

An interactive, mobile-friendly website for a bounce house / party rental business.
It's built with React, Tailwind CSS and Motion (the same stack 21st.dev components use),
and styled with the UI/UX Pro Max "claymorphism" design system.

## What's on the page

- **Hero** with bouncing headline letters, 3D tilt photo, a date picker and animated stats
- **Scrolling trust banner** (pause button included)
- **Rentals catalog** with category filters, spotlight/tilt cards and an **Add to quote** button
- **How it works** with a progress line that fills as you scroll
- **Quote builder + booking form**: picked rentals, add-ons, a live animated total,
  validated form and a confetti success screen
- **Gallery** with a full-screen lightbox (arrow keys and Esc work)
- **Swipeable reviews**, **FAQ accordion**, and a footer call-to-action
- Floating "View quote" button that shows up once something is added
- **Bounce Bot AI chat assistant** (bottom-left) that answers questions about rentals,
  prices, space, weather and booking, and can add rentals to the quote in one tap

## Editing content (no coding needed)

Almost everything lives in **`src/data/site.ts`**:

| What | Where in `site.ts` |
| --- | --- |
| Business name, phone, email, hours, socials | `business` |
| Rentals (name, price, size, ages, photo, color) | `rentals` |
| Add-ons (generator, tables…) | `addOns` |
| Reviews | `testimonials` |
| FAQ | `faqs` |
| Gallery photos | `gallery` |

Photos are in **`public/images/`**. To swap one, drop in a new file with the same name
(or change the path in `site.ts`). All current photos are AI-generated placeholders, so
replace them with real photos of your equipment when you can.

### Receiving booking requests

By default, the form opens the visitor's email app with the booking details filled in.
To get requests straight to your inbox instead, create a free form at
[formspree.io](https://formspree.io) and paste the endpoint into `business.formEndpoint`.

### The AI chat assistant (Bounce Bot)

Bounce Bot learns everything from `src/data/site.ts` (rentals, prices, add-ons, FAQ, phone,
hours), so when you edit that file its answers update too. Its personality and rules are in
`src/lib/knowledge.ts`.

It answers in one of three ways, picking the first that works:

1. **Claude AI via `/api/chat`** (best). Deploy to [Vercel](https://vercel.com) and add an
   environment variable `ANTHROPIC_API_KEY` with a key from
   [console.anthropic.com](https://console.anthropic.com). The function in `api/chat.ts`
   deploys automatically. Each chat message costs a fraction of a cent.
2. **Claude in the viewer's own account** when the site is shared as a Claude artifact.
3. **Offline answers** built from `site.ts`. Used automatically when no AI is available
   (local `npm run dev`, GitHub Pages, or no API key), so the chat never breaks.

To host the API somewhere else, set `VITE_CHAT_ENDPOINT` to its URL at build time
(or `off` to always use offline answers).

## Running it

```bash
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # production files go to /dist
```

The `dist/` folder is a static site. You can host it free on Netlify, Vercel, Cloudflare Pages
or GitHub Pages. For the AI chat, use Vercel (see above); other hosts get the offline answers.
