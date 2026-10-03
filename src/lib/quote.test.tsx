import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { money, QuoteProvider, useQuote } from './quote'

const wrapper = ({ children }: { children: ReactNode }) => <QuoteProvider>{children}</QuoteProvider>

describe('quote', () => {
  it('adds rentals and add-ons to the total', () => {
    const { result } = renderHook(() => useQuote(), { wrapper })
    act(() => result.current.toggleItem('castle'))
    act(() => result.current.toggleExtra('generator'))
    expect(result.current.total).toBe(159 + 75)
    expect(result.current.count).toBe(1)
    expect(result.current.lastAdded).toBe('castle')
  })

  it('removes a rental when it is toggled again', () => {
    const { result } = renderHook(() => useQuote(), { wrapper })
    act(() => result.current.toggleItem('castle'))
    act(() => result.current.toggleItem('castle'))
    expect(result.current.total).toBe(0)
    expect(result.current.hasItem('castle')).toBe(false)
  })

  it('ignores ids that are not in the catalog', () => {
    const { result } = renderHook(() => useQuote(), { wrapper })
    act(() => result.current.toggleItem('no-such-rental'))
    expect(result.current.total).toBe(0)
  })

  it('throws when used outside QuoteProvider', () => {
    expect(() => renderHook(() => useQuote())).toThrow('useQuote must be used inside QuoteProvider')
  })

  it('formats whole dollars', () => {
    expect(money(1234)).toBe('$1,234')
  })
})
