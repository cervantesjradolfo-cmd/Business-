import { describe, expect, it } from 'vitest'
import { EMPTY_MAILBOX, loadMailbox } from './outreach'
import { effectiveDailyCap, inSendWindow, nextWindowStart, warmupLabel, windowLabel, zonedParts } from './sendWindow'

const NY = { ...EMPTY_MAILBOX, timeZone: 'America/New_York' } // Mon to Fri, 9:00 to 17:00

describe('send window', () => {
  it('reads the weekday and hour in the mailbox time zone', () => {
    // Fri 16 Oct 2026, 13:30 UTC = 09:30 in New York (EDT)
    expect(zonedParts(new Date('2026-10-16T13:30:00Z'), 'America/New_York')).toEqual({ day: 5, hour: 9, minute: 30 })
    expect(zonedParts(new Date('2026-10-16T13:30:00Z'), 'Asia/Tokyo')).toEqual({ day: 5, hour: 22, minute: 30 })
  })
  it('is open on weekdays during business hours only', () => {
    expect(inSendWindow(NY, new Date('2026-10-16T13:30:00Z'))).toBe(true) // Fri 09:30
    expect(inSendWindow(NY, new Date('2026-10-16T12:59:00Z'))).toBe(false) // Fri 08:59
    expect(inSendWindow(NY, new Date('2026-10-16T21:00:00Z'))).toBe(false) // Fri 17:00
    expect(inSendWindow(NY, new Date('2026-10-17T15:00:00Z'))).toBe(false) // Sat 11:00
  })
  it('finds the next opening, over a weekend', () => {
    expect(nextWindowStart(NY, new Date('2026-10-16T22:00:00Z'))?.toISOString()).toBe('2026-10-19T13:00:00.000Z') // Mon 09:00 EDT
    const now = new Date('2026-10-16T14:00:00Z')
    expect(nextWindowStart(NY, now)).toBe(now)
    expect(nextWindowStart({ ...NY, sendDays: [] }, now)).toBeNull()
  })
  it('handles the switch to winter time', () => {
    // Mon 2 Nov 2026 09:00 EST = 14:00 UTC (DST ended on Sun 1 Nov)
    expect(nextWindowStart(NY, new Date('2026-10-30T22:00:00Z'))?.toISOString()).toBe('2026-11-02T14:00:00.000Z')
  })
  it('describes the window', () => {
    expect(windowLabel(NY)).toBe('Mon to Fri, 09:00 to 17:00')
    expect(windowLabel({ ...NY, sendDays: [0, 6], sendStart: 10, sendEnd: 24 })).toBe('Sat, Sun, 10:00 to 24:00')
  })
})

describe('warm-up', () => {
  const m = { dailyCap: 40, warmup: true }
  const start = '2026-10-01T15:00:00Z'
  it('starts at 10 a day and adds 5 each week up to the daily limit', () => {
    expect(effectiveDailyCap(m, undefined, new Date('2026-10-01T15:00:00Z'))).toBe(10)
    expect(effectiveDailyCap(m, start, new Date('2026-10-07T15:00:00Z'))).toBe(10)
    expect(effectiveDailyCap(m, start, new Date('2026-10-08T15:00:00Z'))).toBe(15)
    expect(effectiveDailyCap(m, start, new Date('2026-10-29T15:00:00Z'))).toBe(30)
    expect(effectiveDailyCap(m, start, new Date('2027-01-01T15:00:00Z'))).toBe(40)
    expect(effectiveDailyCap({ ...m, warmup: false }, undefined, new Date())).toBe(40)
  })
  it('explains itself while it is limiting', () => {
    expect(warmupLabel(m, start, new Date('2026-10-08T15:00:00Z'))).toBe('Warm-up week 2: up to 15 a day, 5 more each week until your limit of 40')
    expect(warmupLabel(m, start, new Date('2027-01-01T15:00:00Z'))).toBe('')
  })
})

describe('loading the schedule', () => {
  it('defaults to Mon to Fri, 9 to 5, warm-up on, and repairs bad values', () => {
    window.localStorage.setItem('m', JSON.stringify({ host: 'smtp.gmail.com' }))
    expect(loadMailbox('m')).toMatchObject({ sendDays: [1, 2, 3, 4, 5], sendStart: 9, sendEnd: 17, warmup: true })
    window.localStorage.setItem('m', JSON.stringify({ sendDays: [6, 6, 9, 'x', 0], sendStart: 18, sendEnd: 8, timeZone: 'Not/AZone', warmup: false }))
    const m = loadMailbox('m')
    expect(m).toMatchObject({ sendDays: [0, 6], sendStart: 9, sendEnd: 17, warmup: false })
    expect(m.timeZone).not.toBe('Not/AZone')
    window.localStorage.setItem('m', JSON.stringify({ timeZone: 'Europe/London', sendStart: 0, sendEnd: 24 }))
    expect(loadMailbox('m')).toMatchObject({ timeZone: 'Europe/London', sendStart: 0, sendEnd: 24 })
  })
})
