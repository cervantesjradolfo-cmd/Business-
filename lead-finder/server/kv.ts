// A tiny Upstash Redis client over its REST API (no SDK). Set up by adding Upstash Redis to the
// Vercel project (Storage / Marketplace), which sets KV_REST_API_URL and KV_REST_API_TOKEN, or set
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN yourself.
import { randomUUID } from 'node:crypto'

const url = () => (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').trim().replace(/\/+$/, '')
const token = () => (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim()

export const kvConfigured = () => /^https:\/\//.test(url()) && !!token()

export class KvError extends Error {}

export async function kv<T = unknown>(...command: (string | number)[]): Promise<T> {
  let res: Response
  try {
    res = await fetch(url(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new KvError("Couldn't reach the database.")
  }
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string }
  if (!res.ok || data.error) throw new KvError('The database refused the request.')
  return data.result as T
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await kv<string | null>('GET', key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const setJson = (key: string, value: unknown) => kv('SET', key, JSON.stringify(value))

// A lock that expires on its own, so a crashed run can't block forever. Returns a release function, or null if taken.
export async function lock(key: string, ms: number): Promise<(() => Promise<void>) | null> {
  const id = randomUUID()
  const ok = await kv<string | null>('SET', key, id, 'NX', 'PX', ms)
  if (ok !== 'OK') return null
  return async () => {
    // Delete only if it is still ours.
    await kv('EVAL', "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, id).catch(() => {})
  }
}
