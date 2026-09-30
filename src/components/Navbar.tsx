import { AnimatePresence, motion } from 'motion/react'
import { Menu, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { business } from '../data/site'
import { Logo } from './Logo'

const links = [
  { href: '#rentals', label: 'Rentals' },
  { href: '#how', label: 'How it works' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#faq', label: 'FAQ' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive('#' + e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    links.forEach((l) => {
      const el = document.querySelector(l.href)
      if (el) observer.observe(el)
    })
    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-300 sm:px-5 ${
          scrolled ? 'bg-white/85 shadow-lg shadow-blue-900/10 backdrop-blur-lg' : 'bg-white/60 backdrop-blur-sm'
        }`}
      >
        <a href="#top" className="rounded-full" aria-label={`${business.name} home`}>
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                aria-current={active === l.href ? 'true' : undefined}
                className="relative rounded-full px-4 py-2 font-display text-[17px] font-semibold text-ink transition-colors hover:text-primary"
              >
                {active === l.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-sun/70"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${business.phone.replace(/\D/g, '')}`}
            className="hidden items-center gap-2 rounded-full px-3 py-2 font-bold text-primary hover:bg-blue-50 lg:flex"
          >
            <Phone className="size-4" aria-hidden="true" />
            {business.phone}
          </a>
          <a href="#book" className="btn-primary hidden !min-h-11 !px-5 !text-base sm:inline-flex">
            Book now
          </a>
          <button
            type="button"
            className="grid size-11 cursor-pointer place-items-center rounded-full bg-primary text-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="clay mx-auto mt-2 max-w-6xl p-3 md:hidden"
          >
            <ul className="grid gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 font-display text-xl font-bold hover:bg-sky"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <a href="#book" onClick={() => setOpen(false)} className="btn-primary">
                Book now
              </a>
              <a href={`tel:${business.phone.replace(/\D/g, '')}`} className="btn-secondary">
                <Phone className="size-4" aria-hidden="true" /> Call us
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
