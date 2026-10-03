import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import { CalendarDays, ShieldCheck, Sparkles, Star, Truck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { business, stats } from '../data/site'
import { useQuote } from '../lib/quote'

/** Each letter hops on load, and again when hovered */
function BouncyWord({ word, className }: { word: string; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className={`inline-block whitespace-nowrap ${className ?? ''}`} aria-label={word}>
      {word.split('').map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="inline-block"
          initial={reduce ? false : { y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          whileHover={reduce ? undefined : { y: [0, -22, 0], transition: { duration: 0.45 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 12, delay: 0.3 + i * 0.06 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}

function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [val, setVal] = useState(reduce ? to : 0)
  useEffect(() => {
    if (!inView || reduce) return
    const c = animate(0, to, { duration: 1.6, ease: 'easeOut', onUpdate: setVal })
    return () => c.stop()
  }, [inView, to, reduce])
  return <span ref={ref}>{val.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>
}

const confetti = [
  { c: 'bg-pop', s: 'size-4 rounded-full', p: 'left-[6%] top-[22%]', d: 0 },
  { c: 'bg-sun', s: 'size-6 rounded-lg rotate-12', p: 'left-[46%] top-[12%]', d: 1.2 },
  { c: 'bg-primary', s: 'size-3 rounded-full', p: 'left-[38%] bottom-[18%]', d: 0.6 },
  { c: 'bg-grass', s: 'size-5 rounded-md -rotate-12', p: 'right-[4%] top-[18%]', d: 2 },
  { c: 'bg-pop', s: 'size-3 rounded-sm rotate-45', p: 'right-[42%] bottom-[8%]', d: 1.6 },
]

export function Hero() {
  const { date, setDate } = useQuote()
  const reduce = useReducedMotion()
  const today = new Date().toISOString().slice(0, 10)

  // Mouse-follow 3D tilt on the hero picture
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 15 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 15 })
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => {
    mx.set(0)
    my.set(0)
  }

  const onCheck = (e: FormEvent) => {
    e.preventDefault()
    document.getElementById('book')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 lg:pb-24">
      {/* Soft sky blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-sun/40 blur-3xl" />
        <div className="absolute top-20 -right-40 size-[560px] rounded-full bg-pop/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-primary/15 blur-3xl" />
      </div>
      {confetti.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`absolute hidden animate-float lg:block ${b.c} ${b.s} ${b.p}`}
          style={{ animationDelay: `${b.d}s` }}
        />
      ))}

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="eyebrow"
          >
            <Sparkles className="size-4" aria-hidden="true" /> Now booking weekends
          </motion.span>

          <h1 className="mt-5 text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Let's get this party{' '}
            <BouncyWord word="bouncing!" className="text-pop drop-shadow-[0_4px_0_#FCD34D]" />
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl"
          >
            Squeaky-clean bounce houses, water slides and obstacle courses for birthdays, schools
            and community events. <strong className="text-ink">Free delivery, setup and pickup.</strong>
          </motion.p>

          {/* Quick availability check */}
          <motion.form
            onSubmit={onCheck}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="clay mt-8 flex max-w-xl flex-col gap-2 p-2 sm:flex-row sm:items-center sm:rounded-full"
          >
            <label htmlFor="hero-date" className="flex flex-1 items-center gap-3 px-4 py-2">
              <CalendarDays className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex flex-1 flex-col">
                <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">Party date</span>
                <input
                  id="hero-date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full cursor-pointer bg-transparent font-display text-lg font-bold text-ink outline-none"
                />
              </span>
            </label>
            <button type="submit" className="btn-primary">
              Check availability
            </button>
          </motion.form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink-soft">
            <li className="flex items-center gap-1.5">
              <Truck className="size-4 text-primary" aria-hidden="true" /> Free delivery
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-grass" aria-hidden="true" /> Fully insured
            </li>
            <li className="flex items-center gap-1.5">
              <Star className="size-4 fill-sun text-sun-dark" aria-hidden="true" /> 4.9 from 380+ reviews
            </li>
          </ul>
        </div>

        {/* Picture with tilt + floating badges */}
        <div className="relative [perspective:1200px]" onPointerMove={onMove} onPointerLeave={onLeave}>
          <motion.div
            style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
            initial={reduce ? false : { opacity: 0, scale: 0.85, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-[40px] border-[6px] border-white bg-white shadow-2xl shadow-blue-900/25">
              <img
                src="images/hero.webp"
                alt={`A colorful ${business.name} castle bounce house set up at a sunny backyard party`}
                width={1216}
                height={832}
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            <div
              style={{ transform: 'translateZ(60px)' }}
              className="clay absolute -bottom-6 left-3 flex items-center gap-3 px-4 py-3 sm:-left-6"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-grass text-white">
                <ShieldCheck className="size-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-display text-lg leading-tight font-extrabold">Sanitized</span>
                <span className="block text-sm text-ink-soft">after every party</span>
              </span>
            </div>

            <div
              style={{ transform: 'translateZ(80px)' }}
              className="absolute -top-5 -right-3 animate-wiggle rounded-full bg-sun px-5 py-3 text-center font-display leading-none font-extrabold shadow-lg sm:-right-6"
            >
              <span className="block text-xs tracking-wide uppercase">from</span>
              <span className="block text-3xl">$159</span>
              <span className="block text-xs">/ day</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto mt-16 grid max-w-4xl grid-cols-3 gap-3 px-4 sm:gap-6 sm:px-6">
        {stats.map((s) => (
          <div key={s.label} className="clay px-2 py-5 text-center sm:py-6">
            <div className="font-display text-3xl font-extrabold text-primary tabular-nums sm:text-5xl">
              <CountUp to={s.value} decimals={s.decimals} />
              <span className="text-pop">{s.suffix}</span>
            </div>
            <div className="mt-1 text-xs font-bold text-ink-soft sm:text-base">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
