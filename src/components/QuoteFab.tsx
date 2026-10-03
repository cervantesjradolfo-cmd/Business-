import { AnimatePresence, motion } from 'motion/react'
import { PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { rentals } from '../data/site'
import { money, useQuote } from '../lib/quote'

/** Floating "your quote" button that pops in once something is added */
export function QuoteFab() {
  const { count, total, lastAdded, items } = useQuote()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!lastAdded || !items.includes(lastAdded)) return
    setToast(rentals.find((r) => r.id === lastAdded)?.name ?? null)
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [lastAdded, items])

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      <div aria-live="polite" className="sr-only">
        {toast ? `${toast} added to your quote` : ''}
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
            className="rounded-2xl bg-ink px-4 py-2 font-bold text-white shadow-lg"
          >
            {toast} added!
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {count > 0 && (
          <motion.a
            href="#book"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="btn-primary pointer-events-auto !min-h-14 !pr-3 !pl-5"
          >
            <PartyPopper className="size-5" aria-hidden="true" />
            <span>View quote · {money(total)}</span>
            <motion.span
              key={count}
              initial={{ scale: 1.6 }}
              animate={{ scale: 1 }}
              className="grid size-8 place-items-center rounded-full bg-white text-base text-pop"
            >
              {count}
            </motion.span>
          </motion.a>
        )}
      </AnimatePresence>
    </div>
  )
}
