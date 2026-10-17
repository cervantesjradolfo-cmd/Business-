// When Lead Finder may send: your sending days and hours (in the mailbox's time zone), and the
// warm-up ramp that keeps a new mailbox's daily volume low and raises it week by week.
import type { Mailbox } from './types.js'

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WARMUP_START = 10 // emails a day in the first week
export const WARMUP_STEP = 5 // added each week after that, up to your daily limit
const DAY_MS = 86_400_000

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Weekday (0 = Sunday) and hour/minute of `at` in the time zone.
export function zonedParts(at: Date, timeZone: string): { day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { day: DAY_NAMES.indexOf(get('weekday') as (typeof DAY_NAMES)[number]), hour: Number(get('hour')) % 24, minute: Number(get('minute')) }
}

export function inSendWindow(m: Pick<Mailbox, 'sendDays' | 'sendStart' | 'sendEnd' | 'timeZone'>, at: Date): boolean {
  const { day, hour } = zonedParts(at, m.timeZone)
  return m.sendDays.includes(day) && hour >= m.sendStart && hour < m.sendEnd
}

// The next time sending may start (now if already inside the window), to the minute; null if no day is ticked.
export function nextWindowStart(m: Pick<Mailbox, 'sendDays' | 'sendStart' | 'sendEnd' | 'timeZone'>, at: Date): Date | null {
  if (m.sendDays.length === 0 || m.sendStart >= m.sendEnd) return null
  if (inSendWindow(m, at)) return at
  // Step to the top of each hour for 8 days: time zones and DST make plain date maths unreliable.
  const t = new Date(at.getTime())
  t.setUTCMinutes(0, 0, 0)
  for (let i = 0; i < 24 * 8 * 4; i++) {
    t.setTime(t.getTime() + 15 * 60_000)
    if (t.getTime() > at.getTime() && inSendWindow(m, t)) return t
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')
export function windowLabel(m: Pick<Mailbox, 'sendDays' | 'sendStart' | 'sendEnd'>): string {
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => m.sendDays.includes(d)).map((d) => DAY_NAMES[d])
  const dayText = days.join(', ') === 'Mon, Tue, Wed, Thu, Fri' ? 'Mon to Fri' : days.join(', ') || 'no days'
  return `${dayText}, ${pad(m.sendStart)}:00 to ${pad(m.sendEnd)}:00`
}

// Today's limit: your daily limit, or less while a new mailbox warms up.
export function effectiveDailyCap(m: Pick<Mailbox, 'dailyCap' | 'warmup'>, startedAt: string | undefined, now: Date): number {
  if (!m.warmup) return m.dailyCap
  const started = startedAt ? new Date(startedAt).getTime() : now.getTime()
  const weeks = Math.max(0, Math.floor((now.getTime() - started) / (7 * DAY_MS)))
  return Math.min(m.dailyCap, WARMUP_START + WARMUP_STEP * weeks)
}

export function warmupLabel(m: Pick<Mailbox, 'dailyCap' | 'warmup'>, startedAt: string | undefined, now: Date): string {
  if (!m.warmup) return ''
  const cap = effectiveDailyCap(m, startedAt, now)
  if (cap >= m.dailyCap) return ''
  const week = startedAt ? Math.floor((now.getTime() - new Date(startedAt).getTime()) / (7 * DAY_MS)) + 1 : 1
  return `Warm-up week ${week}: up to ${cap} a day, ${WARMUP_STEP} more each week until your limit of ${m.dailyCap}`
}
