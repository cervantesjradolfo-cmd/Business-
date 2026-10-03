import confetti from 'canvas-confetti'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { AlertCircle, CheckCircle2, Loader2, PartyPopper, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { addOns, business, rentals } from '../data/site'
import { money, useQuote } from '../lib/quote'
import { Reveal, SectionHeading } from './ui'

function AnimatedTotal({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const prev = useRef(value)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return setShown(value)
    const c = animate(prev.current, value, { duration: 0.5, ease: 'easeOut', onUpdate: (v) => setShown(Math.round(v)) })
    prev.current = value
    return () => c.stop()
  }, [value, reduce])
  return <span className="tabular-nums">{money(shown)}</span>
}

type Fields = { name: string; email: string; phone: string; date: string; address: string; event: string; notes: string }
type Errors = Partial<Record<keyof Fields, string>>

const labels: Record<keyof Fields, string> = {
  name: 'Your name',
  email: 'Email',
  phone: 'Phone',
  date: 'Party date',
  address: 'Party address or ZIP',
  event: 'Type of event',
  notes: 'Anything else?',
}

function validate(f: Fields): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = 'Please tell us your name.'
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter an email like name@example.com.'
  if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit phone number so we can text you.'
  if (!f.date) e.date = 'Pick the date of your party.'
  else if (f.date < new Date().toISOString().slice(0, 10)) e.date = 'That date has passed. Pick an upcoming date.'
  if (f.address.trim().length < 5) e.address = 'Add your address or at least your ZIP code.'
  return e
}

export function Booking() {
  const quote = useQuote()
  const reduce = useReducedMotion()
  const today = new Date().toISOString().slice(0, 10)
  const selected = rentals.filter((r) => quote.items.includes(r.id))

  const [f, setF] = useState<Fields>({ name: '', email: '', phone: '', date: quote.date, address: '', event: 'Birthday party', notes: '' })
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const summaryRef = useRef<HTMLDivElement>(null)

  // Keep the hero date picker and this form in sync
  useEffect(() => setF((cur) => ({ ...cur, date: quote.date })), [quote.date])

  const errors = validate(f)
  const showErr = (k: keyof Fields) => (touched[k] || submitted) && errors[k]
  const set = (k: keyof Fields) => (v: string) => {
    setF((cur) => ({ ...cur, [k]: v }))
    if (k === 'date') quote.setDate(v)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) {
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setStatus('sending')
    const payload = {
      ...f,
      rentals: selected.map((r) => r.name).join(', ') || 'Not sure yet',
      addOns: addOns.filter((a) => quote.extras.includes(a.id)).map((a) => a.name).join(', ') || 'None',
      estimatedTotal: money(quote.total),
    }
    try {
      if (import.meta.env.VITE_DEMO) {
        // Demo build: nothing is sent, just show the success screen
        await new Promise((r) => setTimeout(r, 900))
      } else if (business.formEndpoint) {
        const res = await fetch(business.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Request failed')
      } else {
        const body = Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n')
        window.location.href = `mailto:${business.email}?subject=${encodeURIComponent('Booking request: ' + f.date)}&body=${encodeURIComponent(body)}`
        await new Promise((r) => setTimeout(r, 600))
      }
      setStatus('done')
      if (!reduce) {
        confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors: ['#2563EB', '#FCD34D', '#EC4899', '#22C55E'] })
      }
    } catch {
      setStatus('error')
    }
  }

  const input = (k: keyof Fields, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`f-${k}`} className="mb-1.5 block font-bold text-ink">
        {labels[k]} <span className="text-pop" aria-hidden="true">*</span>
      </label>
      <input
        id={`f-${k}`}
        name={k}
        required
        value={f[k]}
        onChange={(e) => set(k)(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
        aria-invalid={!!showErr(k)}
        aria-describedby={showErr(k) ? `e-${k}` : undefined}
        className={`min-h-12 w-full rounded-2xl border-2 bg-white px-4 text-base transition-colors outline-none focus:border-primary ${
          showErr(k) ? 'border-red-500 bg-red-50' : 'border-blue-100'
        }`}
        {...props}
      />
      {showErr(k) && (
        <p id={`e-${k}`} className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-red-700">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {errors[k]}
        </p>
      )}
    </div>
  )

  return (
    <section id="book" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Reserve your date"
          title={
            <>
              Build your <span className="text-pop">dream party</span>
            </>
          }
          text="No payment today. We confirm availability within 2 hours and text you a final quote."
        />

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Quote summary */}
          <Reveal className="clay h-fit p-6 sm:p-8 lg:sticky lg:top-28">
            <h3 className="text-2xl font-extrabold">Your quote</h3>

            <ul className="mt-4 grid gap-2">
              <AnimatePresence initial={false}>
                {selected.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
                    className="flex items-center gap-3 rounded-2xl bg-sky p-2 pr-3"
                  >
                    <img src={r.image} alt="" width={56} height={56} className="size-14 rounded-xl object-cover" />
                    <span className="flex-1 font-bold">{r.name}</span>
                    <span className="font-display text-lg font-bold tabular-nums">{money(r.price)}</span>
                    <button
                      type="button"
                      onClick={() => quote.toggleItem(r.id)}
                      aria-label={`Remove ${r.name}`}
                      className="grid size-10 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-red-100 hover:text-red-700"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {selected.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-blue-200 p-5 text-center">
                <p className="font-bold">No rentals picked yet.</p>
                <a href="#rentals" className="mt-1 inline-block font-bold text-primary underline underline-offset-4">
                  Browse inflatables
                </a>
                <p className="mt-1 text-sm text-ink-soft">or just send the form and we'll help you choose.</p>
              </div>
            )}

            <fieldset className="mt-6">
              <legend className="font-display text-lg font-extrabold">Party add-ons</legend>
              <div className="mt-2 grid gap-2">
                {addOns.map((a) => {
                  const on = quote.extras.includes(a.id)
                  return (
                    <label
                      key={a.id}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors ${
                        on ? 'border-primary bg-blue-50' : 'border-transparent bg-sky hover:border-blue-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => quote.toggleExtra(a.id)}
                        className="size-5 cursor-pointer accent-primary"
                      />
                      <span className="flex-1">
                        <span className="block font-bold">{a.name}</span>
                        <span className="block text-sm text-ink-soft">{a.note}</span>
                      </span>
                      <span className="font-bold tabular-nums">+{money(a.price)}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-6 flex items-end justify-between rounded-2xl bg-ink p-5 text-white">
              <span>
                <span className="block text-sm font-bold text-blue-200">Estimated total</span>
                <span className="block text-xs text-blue-200">Delivery & setup included</span>
              </span>
              <span className="font-display text-4xl font-extrabold text-sun" aria-live="polite">
                <AnimatedTotal value={quote.total} />
              </span>
            </div>
          </Reveal>

          {/* Booking form */}
          <Reveal delay={0.1} className="clay p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {status === 'done' ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid min-h-[480px] place-items-center text-center"
                  role="status"
                >
                  <div>
                    <motion.div
                      initial={{ rotate: -20, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 12 }}
                      className="mx-auto grid size-24 place-items-center rounded-[30px] bg-grass text-white"
                    >
                      <PartyPopper className="size-12" aria-hidden="true" />
                    </motion.div>
                    <h3 className="mt-6 text-3xl font-extrabold">Woohoo, request sent!</h3>
                    <p className="mx-auto mt-2 max-w-sm text-ink-soft">
                      Thanks {f.name.split(' ')[0]}! We'll check availability for{' '}
                      <strong className="text-ink">{new Date(f.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>{' '}
                      and text you within 2 hours.
                    </p>
                    <button type="button" onClick={() => setStatus('idle')} className="btn-secondary mt-6">
                      Send another request
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.form key="form" noValidate onSubmit={onSubmit} exit={{ opacity: 0, scale: 0.97 }} className="grid gap-4">
                  <h3 className="text-2xl font-extrabold">Your details</h3>

                  {submitted && Object.keys(errors).length > 0 && (
                    <div
                      ref={summaryRef}
                      tabIndex={-1}
                      role="alert"
                      className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-800"
                    >
                      <p className="font-bold">Almost there! Please fix {Object.keys(errors).length === 1 ? 'this' : 'these'}:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {(Object.keys(errors) as (keyof Fields)[]).map((k) => (
                          <li key={k}>
                            <a href={`#f-${k}`} className="underline">
                              {labels[k]}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {input('name', { autoComplete: 'name' })}
                    {input('date', { type: 'date', min: today })}
                    {input('email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
                    {input('phone', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: '(555) 555-5555' })}
                  </div>
                  {input('address', { autoComplete: 'street-address' })}

                  <div>
                    <label htmlFor="f-event" className="mb-1.5 block font-bold">
                      {labels.event}
                    </label>
                    <select
                      id="f-event"
                      value={f.event}
                      onChange={(e) => set('event')(e.target.value)}
                      className="min-h-12 w-full cursor-pointer rounded-2xl border-2 border-blue-100 bg-white px-4 outline-none focus:border-primary"
                    >
                      {['Birthday party', 'School event', 'Church / community', 'Corporate picnic', 'Other'].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="f-notes" className="mb-1.5 block font-bold">
                      {labels.notes} <span className="font-normal text-ink-soft">(optional)</span>
                    </label>
                    <textarea
                      id="f-notes"
                      rows={3}
                      value={f.notes}
                      onChange={(e) => set('notes')(e.target.value)}
                      placeholder="Surface type, party times, number of kids..."
                      className="w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 outline-none focus:border-primary"
                    />
                  </div>

                  {status === 'error' && (
                    <p role="alert" className="rounded-2xl bg-red-50 p-3 font-bold text-red-800">
                      Hmm, that didn't go through. Please try again or call us at {business.phone}.
                    </p>
                  )}

                  <button type="submit" disabled={status === 'sending'} className="btn-primary mt-2 w-full !text-xl">
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Sending...
                      </>
                    ) : (
                      <>
                        Request my booking {quote.total > 0 && <span className="opacity-90">· {money(quote.total)}</span>}
                      </>
                    )}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-sm text-ink-soft">
                    <CheckCircle2 className="size-4 text-grass" aria-hidden="true" /> No payment needed to request
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
