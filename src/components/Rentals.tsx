import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Plus, Ruler, Users, Baby } from 'lucide-react'
import { useState, type PointerEvent, type Ref } from 'react'
import { rentals, type Category, type Rental } from '../data/site'
import { money, useQuote } from '../lib/quote'
import { SectionHeading } from './ui'

const filters: ('All' | Category)[] = ['All', 'Bounce Houses', 'Water Slides', 'Combos', 'Obstacle Courses']

// `ref` is forwarded so AnimatePresence popLayout can measure the card
function RentalCard({ r, ref }: { r: Rental; ref?: Ref<HTMLElement> }) {
  const { hasItem, toggleItem } = useQuote()
  const reduce = useReducedMotion()
  const added = hasItem(r.id)

  // Spotlight + tilt that follows the pointer (21st.dev-style "magic card")
  const [tilt, setTilt] = useState({ x: 0, y: 0, px: 50, py: 50 })
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return
    const b = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - b.left) / b.width
    const py = (e.clientY - b.top) / b.height
    setTilt({ x: (0.5 - py) * 8, y: (px - 0.5) * 8, px: px * 100, py: py * 100 })
  }

  return (
    <motion.article
      ref={ref}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0, px: 50, py: 50 })}
      style={{
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        ['--spot-x' as string]: `${tilt.px}%`,
        ['--spot-y' as string]: `${tilt.py}%`,
      }}
      className={`group clay relative flex flex-col overflow-hidden transition-[transform,box-shadow] duration-200 ease-out ${
        added ? 'ring-4 ring-pop' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--spot-x) var(--spot-y), ${r.color}22, transparent 45%)`,
        }}
      />

      <div className="relative m-3 overflow-hidden rounded-[22px]" style={{ backgroundColor: r.color + '22' }}>
        <img
          src={r.image}
          alt={`${r.name} rental`}
          width={1024}
          height={1024}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {r.tag && (
          <span className="absolute top-3 left-3 rounded-full bg-sun px-3 py-1 font-display text-sm font-extrabold text-ink shadow">
            {r.tag}
          </span>
        )}
        <span
          className="absolute right-3 bottom-3 rounded-full px-3 py-1 text-xs font-extrabold text-white shadow"
          style={{ backgroundColor: r.color }}
        >
          {r.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pt-1 pb-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl leading-tight font-extrabold">{r.name}</h3>
          <p className="shrink-0 text-right font-display leading-none">
            <span className="block text-2xl font-extrabold text-primary tabular-nums">{money(r.price)}</span>
            <span className="text-xs font-bold text-ink-soft">per day</span>
          </p>
        </div>
        <p className="mt-2 text-ink-soft">{r.blurb}</p>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          {[
            { icon: Ruler, label: 'Size', value: r.size },
            { icon: Baby, label: 'Ages', value: r.ages },
            { icon: Users, label: 'Fits', value: r.capacity },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-sky px-1 py-2">
              <dt className="flex items-center justify-center gap-1 text-xs font-bold text-ink-soft">
                <Icon className="size-3.5" aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-0.5 font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={() => toggleItem(r.id)}
          aria-pressed={added}
          className={`mt-5 ${added ? 'btn bg-grass text-white shadow-[0_6px_0_#15803d]' : 'btn-secondary ring-2 ring-primary/15'} w-full`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={added ? 'y' : 'n'}
              initial={{ scale: 0.4, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.1 } }}
              className="flex items-center gap-2"
            >
              {added ? <Check className="size-5" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}
              {added ? 'Added to quote' : 'Add to quote'}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </motion.article>
  )
}

export function Rentals() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const shown = filter === 'All' ? rentals : rentals.filter((r) => r.category === filter)

  return (
    <section id="rentals" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Our inflatables"
          title={
            <>
              Pick your <span className="text-primary">bounce</span>
            </>
          }
          text="Every rental includes delivery, setup, stakes or sandbags, and pickup. Add a few to your quote and watch your total update live."
        />

        <div role="group" aria-label="Filter rentals" className="mb-10 flex flex-wrap justify-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`relative min-h-11 cursor-pointer rounded-full px-5 font-display text-lg font-bold transition-colors ${
                filter === f ? 'text-white' : 'bg-sky text-ink hover:bg-blue-100'
              }`}
            >
              {filter === f && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_0_#1e40af]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          Showing {shown.length} {filter === 'All' ? 'rentals' : filter}
        </p>

        <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((r) => (
              <RentalCard key={r.id} r={r} />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
