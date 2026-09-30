import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { addOns, rentals } from '../data/site'

type QuoteState = {
  items: string[]
  extras: string[]
  toggleItem: (id: string) => void
  toggleExtra: (id: string) => void
  hasItem: (id: string) => boolean
  total: number
  count: number
  lastAdded: string | null
  date: string
  setDate: (d: string) => void
}

const QuoteContext = createContext<QuoteState | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>([])
  const [extras, setExtras] = useState<string[]>([])
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [date, setDate] = useState('')

  const value = useMemo<QuoteState>(() => {
    const total =
      rentals.filter((r) => items.includes(r.id)).reduce((s, r) => s + r.price, 0) +
      addOns.filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.price, 0)
    return {
      items,
      extras,
      total,
      count: items.length,
      lastAdded,
      date,
      setDate,
      hasItem: (id) => items.includes(id),
      toggleItem: (id) => {
        if (items.includes(id)) return setItems(items.filter((x) => x !== id))
        setItems([...items, id])
        setLastAdded(id)
      },
      toggleExtra: (id) =>
        setExtras((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    }
  }, [items, extras, lastAdded, date])

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
}

export function useQuote() {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error('useQuote must be used inside QuoteProvider')
  return ctx
}

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
