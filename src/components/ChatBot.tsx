import { AnimatePresence, motion } from 'motion/react'
import { Check, MessageCircle, Plus, Send, Square, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { business, rentals } from '../data/site'
import { askAssistant, type ChatTurn } from '../lib/assistant'
import { money, useQuote } from '../lib/quote'

const GREETING: ChatTurn = {
  role: 'assistant',
  content: `Hi! I'm Bounce Bot 👑 I can help you pick the perfect rental, check prices, or explain how booking works. What are you celebrating?`,
}

const SUGGESTIONS = [
  'What do you have for toddlers?',
  'Water slide prices?',
  'How much space do I need?',
  'How do I book?',
]

/** Rentals named in a reply, so the visitor can add them straight to the quote */
const mentioned = (text: string) =>
  rentals.filter((r) => text.toLowerCase().includes(r.name.toLowerCase()))

export function ChatBot() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([GREETING])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null) // reply being written
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { hasItem, toggleItem } = useQuote()
  const busy = pending !== null

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [turns, pending])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const history = [...turns, { role: 'user' as const, content }]
    setTurns(history)
    setDraft('')
    setPending('')
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      // The greeting is UI only; the conversation the AI sees starts with the visitor
      const reply = await askAssistant(history.slice(1), setPending, ctl.signal)
      setTurns((t) => [...t, { role: 'assistant', content: reply }])
    } catch {
      setTurns((t) => [...t, { role: 'assistant', content: '(stopped)' }])
    } finally {
      setPending(null)
      abortRef.current = null
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send(draft)
  }

  const shown = pending !== null ? [...turns, { role: 'assistant' as const, content: pending }] : turns

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex flex-col items-start gap-3 sm:bottom-6 sm:left-6">
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label={`Chat with ${business.name}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className="clay pointer-events-auto flex h-[min(560px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] origin-bottom-left flex-col overflow-hidden !p-0 sm:w-[380px]"
          >
            <header className="flex items-center gap-3 bg-primary px-4 py-3 text-white">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sun text-xl" aria-hidden="true">
                👑
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg leading-tight font-bold">Bounce Bot</h2>
                <p className="text-sm text-blue-100">Usually answers instantly</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="grid size-11 cursor-pointer place-items-center rounded-full hover:bg-white/15"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-sky px-4 py-4">
              {shown.map((t, i) => (
                <div key={i} className={t.role === 'user' ? 'flex justify-end' : ''}>
                  <div
                    className={`max-w-[85%] rounded-[22px] px-4 py-2.5 whitespace-pre-line ${
                      t.role === 'user'
                        ? 'rounded-br-md bg-pop text-white'
                        : 'rounded-bl-md bg-white text-ink shadow-sm'
                    }`}
                  >
                    {t.content || <TypingDots />}
                  </div>
                  {t.role === 'assistant' && i > 0 && !(busy && i === shown.length - 1) && (
                    <div className="mt-2 grid gap-2">
                      {mentioned(t.content).map((r) => {
                        const added = hasItem(r.id)
                        return (
                          <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white p-2 shadow-sm">
                            <img src={r.image} alt="" className="size-12 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold">{r.name}</p>
                              <p className="text-sm text-ink-soft">{money(r.price)}/day</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleItem(r.id)}
                              aria-pressed={added}
                              className={`flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-bold ${
                                added ? 'bg-grass text-white' : 'bg-sun text-ink'
                              }`}
                            >
                              {added ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                              {added ? 'Added' : 'Add'}
                              <span className="sr-only"> {r.name} to quote</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {turns.length === 1 && !busy && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="min-h-11 cursor-pointer rounded-full border-2 border-blue-200 bg-white px-3 text-sm font-bold text-primary hover:border-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-blue-100 bg-white p-3">
              <label htmlFor="chat-input" className="sr-only">
                Type your question
              </label>
              <input
                id="chat-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={1000}
                autoComplete="off"
                placeholder="Ask about rentals, prices…"
                className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-blue-100 bg-sky px-4 text-base outline-none focus:border-primary"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Stop reply"
                  className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-white"
                >
                  <Square className="size-4 fill-white" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Send"
                  className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-pop text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="size-5" aria-hidden="true" />
                </button>
              )}
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Chat with Bounce Bot'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="pointer-events-auto flex min-h-14 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 font-display sm:pr-5 text-lg font-bold text-white shadow-[0_6px_0_#1e40af,0_14px_24px_-8px_#2563eb99]"
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <MessageCircle className="size-6" aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only">{open ? 'Close' : 'Ask us'}</span>
      </motion.button>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-2" aria-label="Bounce Bot is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-primary/50"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}
