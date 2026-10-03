import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { gallery } from '../data/site'
import { Reveal, SectionHeading } from './ui'

export function Gallery() {
  const [open, setOpen] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastTrigger = useRef<HTMLButtonElement | null>(null)

  const close = useCallback(() => {
    setOpen(null)
    lastTrigger.current?.focus()
  }, [])
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + gallery.length) % gallery.length)), [])

  useEffect(() => {
    if (open === null) return
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close, step])

  return (
    <section id="gallery" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Party gallery"
          title={
            <>
              Real parties, <span className="text-primary">real smiles</span>
            </>
          }
          text="From backyard birthdays to citywide festivals. Tap any photo to take a closer look."
        />

        <div className="grid auto-rows-[220px] grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {gallery.map((g, i) => (
            <Reveal key={g.src} delay={i * 0.06} className={g.span}>
              <button
                type="button"
                onClick={(e) => {
                  lastTrigger.current = e.currentTarget
                  setOpen(i)
                }}
                className="group relative size-full cursor-pointer overflow-hidden rounded-[28px] border-4 border-white shadow-lg shadow-blue-900/10"
                aria-label={`Open photo: ${g.alt}`}
              >
                <motion.img
                  layoutId={`g-${i}`}
                  src={g.src}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute right-3 bottom-3 grid size-11 translate-y-2 place-items-center rounded-full bg-white/90 text-primary opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Expand className="size-5" aria-hidden="true" />
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink/85 p-4 backdrop-blur-sm"
            onClick={close}
          >
            <motion.img
              layoutId={`g-${open}`}
              key={open}
              src={gallery[open].src}
              alt={gallery[open].alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80dvh] w-auto max-w-full rounded-[28px] border-4 border-white object-contain shadow-2xl"
            />
            <p className="absolute bottom-6 left-1/2 w-[90%] max-w-lg -translate-x-1/2 text-center font-bold text-white">
              {gallery[open].alt}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close photo"
              className="absolute top-4 right-4 grid size-12 cursor-pointer place-items-center rounded-full bg-white text-ink"
            >
              <X className="size-6" />
            </button>
            {[-1, 1].map((d) => (
              <button
                key={d}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  step(d)
                }}
                aria-label={d < 0 ? 'Previous photo' : 'Next photo'}
                className={`absolute top-1/2 grid size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white text-ink ${d < 0 ? 'left-4' : 'right-4'}`}
              >
                {d < 0 ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
