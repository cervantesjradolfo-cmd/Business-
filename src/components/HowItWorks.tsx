import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { MousePointerClick, CalendarCheck, Truck } from 'lucide-react'
import { useRef } from 'react'
import { steps } from '../data/site'
import { Reveal, SectionHeading, Wave } from './ui'

const icons = [MousePointerClick, CalendarCheck, Truck]
const colors = ['bg-pop', 'bg-sun text-ink', 'bg-grass']

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] })
  const line = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section id="how" className="relative bg-primary text-white">
      <Wave fill="#fff" className="rotate-180" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          light
          eyebrow="Easy as 1-2-3"
          title="Party planning, minus the stress"
          text="Booking takes about two minutes. We handle all the heavy lifting."
        />

        <div ref={ref} className="relative grid gap-8 md:grid-cols-3">
          {/* Progress line that fills as you scroll */}
          <div aria-hidden="true" className="absolute top-12 right-[16%] left-[16%] hidden h-2 rounded-full bg-white/20 md:block">
            <motion.div
              style={{ scaleX: reduce ? 1 : line }}
              className="h-full origin-left rounded-full bg-sun"
            />
          </div>

          {steps.map((s, i) => {
            const Icon = icons[i]
            return (
              <Reveal key={s.title} delay={i * 0.12} className="relative text-center">
                <motion.div
                  whileHover={reduce ? undefined : { y: -8, rotate: i % 2 ? 6 : -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                  className={`relative mx-auto grid size-24 place-items-center rounded-[30px] border-4 border-white shadow-[0_10px_0_rgb(0_0_0/0.15)] ${colors[i]}`}
                >
                  <Icon className="size-10" aria-hidden="true" />
                  <span className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white font-display text-lg font-extrabold text-primary shadow">
                    {i + 1}
                  </span>
                </motion.div>
                <h3 className="mt-6 text-2xl font-extrabold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-blue-100">{s.text}</p>
              </Reveal>
            )
          })}
        </div>
      </div>
      <Wave fill="#EFF6FF" />
    </section>
  )
}
