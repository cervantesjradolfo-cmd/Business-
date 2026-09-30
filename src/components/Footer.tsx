import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { business } from '../data/site'
import { Logo } from './Logo'
import { Wave } from './ui'

export function Footer() {
  return (
    <footer className="bg-ink text-blue-100">
      <Wave fill="#0F172A" className="-mb-px rotate-180 bg-white" />
      {/* Final CTA */}
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-pop to-primary p-8 text-center text-white sm:p-14">
          <div aria-hidden="true" className="absolute -top-10 -left-10 size-40 rounded-full bg-sun/40 blur-2xl" />
          <h2 className="relative text-4xl font-extrabold sm:text-5xl">Weekends fill up fast!</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-lg text-white/90">
            Lock in your date today. It takes 2 minutes and there's nothing to pay until we confirm.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#book" className="btn bg-sun text-ink shadow-[0_6px_0_#b45309] hover:-translate-y-0.5">
              Reserve my date
            </a>
            <a href={`tel:${business.phone.replace(/\D/g, '')}`} className="btn bg-white/15 text-white ring-2 ring-white/40 hover:bg-white/25">
              <Phone className="size-5" aria-hidden="true" /> {business.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm">
            Locally owned bounce house and party rentals. Clean equipment, friendly crews, and happy kids since day one.
          </p>
          <div className="mt-5 flex gap-3">
            <a href={business.instagram} aria-label="Instagram" className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-pop">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </a>
            <a href={business.facebook} aria-label="Facebook" className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-primary">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z" />
              </svg>
            </a>
          </div>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-white">Explore</h3>
          <ul className="mt-3 grid gap-2">
            {[
              ['#rentals', 'Rentals'],
              ['#how', 'How it works'],
              ['#gallery', 'Gallery'],
              ['#reviews', 'Reviews'],
              ['#faq', 'FAQ'],
            ].map(([h, l]) => (
              <li key={h}>
                <a href={h} className="hover:text-sun">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-white">Contact</h3>
          <ul className="mt-3 grid gap-3">
            <li className="flex gap-2">
              <Phone className="mt-0.5 size-5 shrink-0 text-sun" aria-hidden="true" />
              <a href={`tel:${business.phone.replace(/\D/g, '')}`} className="hover:text-sun">{business.phone}</a>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-5 shrink-0 text-sun" aria-hidden="true" />
              <a href={`mailto:${business.email}`} className="break-all hover:text-sun">{business.email}</a>
            </li>
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-5 shrink-0 text-sun" aria-hidden="true" /> {business.serviceArea}
            </li>
            <li className="flex gap-2">
              <Clock className="mt-0.5 size-5 shrink-0 text-sun" aria-hidden="true" /> {business.hours}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-sm text-blue-200">
        © {new Date().getFullYear()} {business.name}. All rights reserved.
      </div>
    </footer>
  )
}
