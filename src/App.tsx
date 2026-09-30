import { MotionConfig } from 'motion/react'
import { Booking } from './components/Booking'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { Gallery } from './components/Gallery'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Marquee } from './components/Marquee'
import { Navbar } from './components/Navbar'
import { QuoteFab } from './components/QuoteFab'
import { Rentals } from './components/Rentals'
import { Testimonials } from './components/Testimonials'
import { QuoteProvider } from './lib/quote'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QuoteProvider>
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-primary px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">
          <Hero />
          <Marquee />
          <Rentals />
          <HowItWorks />
          <Booking />
          <Gallery />
          <Testimonials />
          <Faq />
        </main>
        <Footer />
        <QuoteFab />
      </QuoteProvider>
    </MotionConfig>
  )
}
