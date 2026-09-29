# Benji's Jumpers — Website

A colorful, mobile-friendly website for Benji's Jumpers bounce house rentals. It's plain HTML/CSS/JS: there's no build step, and you can open `index.html` in a browser.

## Pages
| File | Page |
|------|------|
| `index.html` | Home: hero, why us, popular rentals, how it works, reviews |
| `rentals.html` | All rentals with category filters and FAQs |
| `about.html` | Story, stats, safety promise, event types |
| `contact.html` | Contact info and booking request form |

## Things to update before going live
Search the files for these placeholders and replace them with your real info:

- **Phone:** `(555) 123-4567` and `+15551234567` (used in `tel:` links)
- **Email:** `hello@benjisjumpers.com`
- **Service area:** `Your City &amp; surrounding areas`
- **Rentals:** names, sizes, ages, prices and descriptions in `rentals.html` (the first three also appear on `index.html`)
- **Reviews:** the three sample testimonials on `index.html` are placeholders. Swap in real ones.
- **About story and stats** in `about.html`
- **Social links:** the `href="#"` Facebook, Instagram and TikTok links in each page footer
- **Photos:** the rentals use drawn illustrations. To use real photos, replace the `<svg>` inside a `.rental-art` div with `<img src="img/your-photo.jpg" alt="..." width="800" height="600">`.

## Booking form
The form checks inputs and shows a thank-you message, but **it doesn't send anything yet**. To get submissions by email, create a free form at [Formspree](https://formspree.io) and set the form's action in `contact.html`:

```html
<form id="booking-form" class="form" novalidate action="https://formspree.io/f/YOUR_ID" method="POST">
```

## Colors and fonts
Every color, font and spacing value lives at the top of `css/styles.css` under `:root`. Change `--color-primary` (blue), `--color-accent` (yellow buttons) or `--color-pop` (red) to re-theme the whole site. The full design system is in `design-system/benjis-jumpers/MASTER.md`.

## Hosting
Free option: in the GitHub repo, go to **Settings → Pages**, choose this branch with the `/ (root)` folder, and save.
