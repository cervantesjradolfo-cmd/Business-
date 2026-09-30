import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  light,
}: {
  eyebrow: string
  title: ReactNode
  text?: string
  light?: boolean
}) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <span className="eyebrow">{eyebrow}</span>
      <h2
        className={`mt-4 text-4xl leading-[1.05] font-extrabold sm:text-5xl ${light ? 'text-white' : 'text-ink'}`}
      >
        {title}
      </h2>
      {text && (
        <p className={`mt-4 text-lg ${light ? 'text-blue-100' : 'text-ink-soft'}`}>{text}</p>
      )}
    </Reveal>
  )
}

/** Wavy divider between sections */
export function Wave({ className = '', fill = '#fff' }: { className?: string; fill?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`block h-10 w-full sm:h-16 ${className}`}
    >
      <path
        fill={fill}
        d="M0 40c120 26 240 40 360 28S600 12 720 10s240 26 360 36 240 4 360-14v48H0z"
      />
    </svg>
  )
}
