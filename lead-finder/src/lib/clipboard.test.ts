import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => { vi.restoreAllMocks() })

describe('copyText', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    expect(await copyText('hi')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hi')
  })
  it('falls back to execCommand when clipboard rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('no') }) }, configurable: true })
    ;(document as any).execCommand = vi.fn(() => true)
    expect(await copyText('hi')).toBe(true)
    expect((document as any).execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })
  it('returns false when both methods fail', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    ;(document as any).execCommand = vi.fn(() => false)
    expect(await copyText('hi')).toBe(false)
  })
})
