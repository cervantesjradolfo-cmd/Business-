// @vitest-environment node
// Vercel's Hobby plan refuses a deployment with more than 12 functions (one per file in api/).
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('deployment limits', () => {
  it('has at most 12 API functions', () => {
    const fns = readdirSync(new URL('../api', import.meta.url)).filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('.test.ts'))
    expect(fns.length).toBeLessThanOrEqual(12)
  })
  it('schedules only functions that exist, at most once a day', () => {
    const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { crons?: { path: string; schedule: string }[] }
    const fns = readdirSync(new URL('../api', import.meta.url)).map((f) => `/api/${f.replace(/\.ts$/, '')}`)
    for (const c of cfg.crons ?? []) {
      expect(fns).toContain(c.path)
      expect(c.schedule.split(' ').slice(0, 2).every((f) => /^\d+$/.test(f))).toBe(true) // fixed minute and hour: daily
    }
  })
})
