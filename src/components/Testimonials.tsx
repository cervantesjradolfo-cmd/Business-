import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'
import { useState } from 'react'
import { testimonials } from '../data/site'
import { SectionHeading } from './ui'

const tints = ['bg-pop', 'bg-primary', 'bg-grass', 'bg-sun-dark']

export function Testimonials() {
  const [[i, dir], setState] = useState<[number, number]>([0, 0])
  const reduce = useReducedMotion()
  const go = (d: number) => setState(([cur]) => [(cur + d + testimonials.length) % testimonials.length, d])
  const t = testimonials[i]

  return (
    <section id="reviews" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Happy families"
          title={
            <>
              Parents <span className="text-pop">love</span> us
            </>
          }
        />

        <div className="relative">
          {/* Stacked cards behind for depth */}
          <div aria-hidden="true" className="clay absolute inset-x-8 -bottom-4 h-full rotate-2 opacity-60" />
          <div aria-hidden="true" className="clay absolute inset-x-4 -bottom-2 h-full -rotate-1 opacity-80" />

          <div className="clay relative min-h-[300px] overflow-hidden p-8 sm:p-12" aria-live="polite">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.figure
                key={i}
                custom={dir}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60, rotate: dir * 2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                drag={reduce ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1)
                  else if (info.offset.x > 60) go(-1)
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <Quote className="size-12 text-sun" aria-hidden="true" />
                <div className="mt-2 flex gap-1" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-5 fill-sun text-sun-dark" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-4 font-display text-2xl leading-snug font-semibold text-ink sm:text-3xl">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className={`grid size-12 place-items-center rounded-full font-display text-xl font-extrabold text-white ${tints[i % tints.length]}`}>
                    {t.name[0]}
                  </span>
                  <span>
                    <span className="block font-bold">{t.name}</span>
                    <span className="block text-sm text-ink-soft">{t.event}</span>
                  </span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-4">
          <button type="button" onClick={() => go(-1)} aria-label="Previous review" className="btn-secondary !size-12 !p-0">
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex gap-2">
            {testimonials.map((_, d) => (
              <button
                key={d}
                type="button"
                onClick={() => setState([d, d > i ? 1 : -1])}
                aria-label={`Show review ${d + 1}`}
                aria-current={d === i}
                className="grid size-6 cursor-pointer place-items-center"
              >
                <span className={`block h-3 rounded-full transition-all ${d === i ? 'w-8 bg-pop' : 'w-3 bg-blue-200'}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(1)} aria-label="Next review" className="btn-secondary !size-12 !p-0">
            <ChevronRight className="size-6" />
          </button>
        </div>
      </div>
    </section>
  )
}
