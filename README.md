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

## Running it

```bash
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # production files go to /dist
```

The `dist/` folder is a static site. You can host it free on Netlify, Vercel, Cloudflare Pages
or GitHub Pages.
