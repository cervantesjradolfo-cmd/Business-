// Overpass from the browser. The public Overpass servers often refuse or stall requests from
// cloud data centres (Vercel functions run on AWS), but answer the user's own connection.
// So when the server had to fall back to Nominatim, the app asks Overpass directly.
import { finalizeLeads } from './leads'
import { buildOverpassQuery, OVERPASS_MIRRORS, parseOverpass } from './overpass'
import type { Lead, SearchRequest } from './types'

export const BROWSER_OVERPASS_TIMEOUT_MS = 25_000
const RETRY_WAIT_MS = 2_000
const MIN_ATTEMPT_MS = 4_000

type Opts = { signal?: AbortSignal; timeoutMs?: number; mirrors?: readonly string[]; fetchImpl?: typeof fetch }

export type BrowserOverpassResult = { leads: Lead[] } | { leads: null; report: string }

// Races the mirrors; resolves with the first good answer's leads, or with a one-line report of what
// each mirror answered (shown under the fallback notice) when none answered in time.
export async function browserOverpassSearch(
  center: { lat: number; lon: number },
  req: SearchRequest,
  opts: Opts = {},
): Promise<BrowserOverpassResult> {
  const doFetch = opts.fetchImpl ?? fetch
  const mirrors = opts.mirrors ?? OVERPASS_MIRRORS
  const deadline = Date.now() + (opts.timeoutMs ?? BROWSER_OVERPASS_TIMEOUT_MS)
  const query = buildOverpassQuery(center.lat, center.lon, req.radiusKm, req.category, req.limit)
  const stop = new AbortController()
  const onAbort = () => stop.abort()
  opts.signal?.addEventListener('abort', onAbort)

  // 'retry' for busy answers (429/502/503/504) and dropped connections, which often succeed a moment later.
  const last = new Map<string, string>() // mirror -> what it last answered
  async function once(mirror: string): Promise<{ json: unknown } | 'retry' | 'fail'> {
    const left = deadline - Date.now()
    if (left < MIN_ATTEMPT_MS || stop.signal.aborted) return 'fail'
    return request(mirror, left)
  }
  async function request(mirror: string, left: number): Promise<{ json: unknown } | 'retry' | 'fail'> {
    try {
      const res = await doFetch(mirror, {
        method: 'POST',
        // A form body keeps this a "simple" CORS request (no preflight).
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.any([stop.signal, AbortSignal.timeout(left)]),
      })
      if ([429, 502, 503, 504].includes(res.status)) {
        last.set(mirror, `busy (${res.status})`)
        return 'retry'
      }
      if (res.status !== 200) {
        last.set(mirror, `error (${res.status})`)
        return 'fail'
      }
      const body = (await res.json()) as { elements?: unknown; remark?: unknown } | null
      if (!body || !Array.isArray(body.elements) || (body.elements.length === 0 && body.remark)) {
        last.set(mirror, 'bad answer')
        return 'fail'
      }
      return { json: body }
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        last.set(mirror, 'timed out')
        return 'fail'
      }
      if (stop.signal.aborted) return 'fail'
      last.set(mirror, 'blocked or unreachable')
      return 'retry'
    }
  }

  async function attempt(mirror: string): Promise<unknown> {
    for (let tries = 1; ; tries++) {
      const r = await once(mirror)
      if (r === 'fail') break
      if (r !== 'retry') return r.json
      if (tries >= 3 || Date.now() + RETRY_WAIT_MS + MIN_ATTEMPT_MS > deadline) break
      await new Promise((ok) => setTimeout(ok, RETRY_WAIT_MS))
    }
    throw new Error('mirror failed')
  }

  try {
    const json = await Promise.any(mirrors.map((m) => attempt(m)))
    return { leads: finalizeLeads(parseOverpass(json, center), req.limit) }
  } catch {
    const report = mirrors.map((m) => `${new URL(m).host}: ${last.get(m) ?? 'timed out'}`).join(', ')
    return { leads: null, report }
  } finally {
    stop.abort()
    opts.signal?.removeEventListener('abort', onAbort)
  }
}
