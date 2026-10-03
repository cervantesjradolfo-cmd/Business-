import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { business, faqs } from '../data/site'
import { Reveal, SectionHeading } from './ui'

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="Good questions" title="Frequently asked" />
        <div className="grid gap-3">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <Reveal key={f.q} delay={i * 0.04}>
                <div className={`rounded-[24px] border-2 transition-colors ${isOpen ? 'border-primary bg-sky' : 'border-blue-100 bg-white'}`}>
                  <h3>
                    <button
                      type="button"
                      id={`faq-b-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-p-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left font-display text-xl font-bold"
                    >
                      {f.q}
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className={`grid size-9 shrink-0 place-items-center rounded-full ${isOpen ? 'bg-pop text-white' : 'bg-sun text-ink'}`}
                      >
                        <Plus className="size-5" aria-hidden="true" />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-p-${i}`}
                        role="region"
                        aria-labelledby={`faq-b-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-lg text-ink-soft">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
        <p className="mt-8 text-center text-ink-soft">
          Still wondering? Call or text{' '}
          <a href={`tel:${business.phone.replace(/\D/g, '')}`} className="font-bold text-primary underline underline-offset-4">
            {business.phone}
          </a>
        </p>
      </div>
    </section>
  )
}
