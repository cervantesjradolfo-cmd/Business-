import { buildTemplatePitch } from './pitch'
import { getAccessKey } from './storage'
import type {
  AlertRequest, AuditResult, CrmLead, CrmResult, Integrations, Reviews, ReviewsRequest, FollowUpRequest, FollowUpResponse, InboxRequest, InboxResult, Pitch, PitchRequest, ProjectsRequest, ProjectsResponse,
  ReplyDraft, ReplyDraftResponse, ReplyRequest, SearchRequest, SearchResponse, SendRequest, SendResult,
} from './types'

export class ApiUnavailableError extends Error {}

// Where the API lives. Empty = same origin (Vite dev server or Vercel).
const BASE: string = import.meta.env.VITE_API_BASE ?? ''

function accessHeaders(): Record<string, string> {
  const key = getAccessKey()
  return key ? { 'Content-Type': 'application/json', 'x-access-key': key } : { 'Content-Type': 'application/json' }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/${path}`, {
      method: 'POST',
      headers: accessHeaders(),
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new ApiUnavailableError('API unreachable')
  }
  // A static host answers with 404/405 or index.html: there is no backend here.
  if (res.status === 404 || res.status === 405 || !res.headers.get('content-type')?.startsWith('application/json')) {
    // 404 with a JSON error body is a real answer (e.g. location not found)
    if (!(res.status === 404 && res.headers.get('content-type')?.startsWith('application/json'))) {
      throw new ApiUnavailableError('API unavailable')
    }
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new ApiUnavailableError('API unavailable')
  }
  if (res.status === 401) throw new Error('Access key required. Add your access key under "Your details".')
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? 'Something went wrong')
  return data as T
}

// Waits before each retry of a search that found the map servers busy.
export const BUSY_RETRY_MS = [8_000, 20_000]

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason) }, { once: true })
  })

// When the map servers are busy the search fails, or falls back to a partial search; either way it
// is tried again a couple of times, keeping the best answer. onRetry(n) is called before retry n.
export async function searchLeads(
  req: SearchRequest, signal?: AbortSignal, onRetry?: (attempt: number) => void, waits: number[] = BUSY_RETRY_MS,
): Promise<SearchResponse> {
  let best: SearchResponse | undefined
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await post<SearchResponse>('search', req, signal)
      if (res.source !== 'nominatim') return res
      if (!best || res.leads.length > best.leads.length) best = res
    } catch (e) {
      const busy = e instanceof Error && !(e instanceof ApiUnavailableError) && /busy/i.test(e.message)
      if (!busy || signal?.aborted) throw e
      if (attempt >= waits.length) {
        if (best) return best
        throw e
      }
    }
    if (attempt >= waits.length) return best!
    onRetry?.(attempt + 1)
    await sleep(waits[attempt], signal)
  }
}

export function searchProjects(req: ProjectsRequest, signal?: AbortSignal): Promise<ProjectsResponse> {
  return post<ProjectsResponse>('projects', req, signal)
}

export async function auditLeads(
  leads: { id: string; website: string }[],
  signal?: AbortSignal,
): Promise<AuditResult[]> {
  try {
    const data = await post<{ results: AuditResult[] }>('audit', { leads }, signal)
    return Array.isArray(data.results) ? data.results : []
  } catch (e) {
    if (signal?.aborted) throw e
    return []
  }
}

export async function fetchPitch(req: PitchRequest, signal?: AbortSignal): Promise<Pitch> {
  try {
    return await post<Pitch>('pitch', req, signal)
  } catch (e) {
    if (signal?.aborted) throw e
    return buildTemplatePitch(req)
  }
}

// AI-written follow-up body, or null when AI isn't set up on the server (or the call fails).
export async function fetchFollowUp(req: FollowUpRequest, signal?: AbortSignal): Promise<string | null> {
  try {
    const data = await post<FollowUpResponse>('followup', req, signal)
    return typeof data.body === 'string' && data.body.trim() ? data.body : null
  } catch (e) {
    if (signal?.aborted) throw e
    return null
  }
}

// Sends one email through the caller's own mailbox. Keeps the error `code`, so it doesn't use post().
export async function sendEmail(req: SendRequest, signal?: AbortSignal): Promise<SendResult> {
  const unavailable: SendResult = { ok: false, code: 'unavailable', error: 'Could not reach the server.' }
  let res: Response
  try {
    res = await fetch(`${BASE}/api/send`, { method: 'POST', headers: accessHeaders(), body: JSON.stringify(req), signal })
  } catch (e) {
    if (signal?.aborted) throw e
    return unavailable
  }
  if (res.status === 401) return { ok: false, code: 'access', error: 'Access key required. Add your access key under "Your details".' }
  try {
    const data = (await res.json()) as Partial<SendResult> | null
    if (data && typeof data === 'object' && typeof data.ok === 'boolean') return data as SendResult
  } catch {
    // not JSON: no backend here
  }
  return unavailable
}

// Reads replies from the caller's own mailbox. Keeps the error `code`, like sendEmail.
export async function checkInbox(req: InboxRequest, signal?: AbortSignal): Promise<InboxResult> {
  const unavailable: InboxResult = { ok: false, code: 'unavailable', error: 'Could not reach the server.' }
  let res: Response
  try {
    res = await fetch(`${BASE}/api/inbox`, { method: 'POST', headers: accessHeaders(), body: JSON.stringify(req), signal })
  } catch (e) {
    if (signal?.aborted) throw e
    return unavailable
  }
  if (res.status === 401) return { ok: false, code: 'access', error: 'Access key required. Add your access key under "Your details".' }
  try {
    const data = (await res.json()) as Partial<InboxResult> | null
    if (data && typeof data === 'object' && typeof data.ok === 'boolean') return data as InboxResult
  } catch {
    // not JSON: no backend here
  }
  return unavailable
}

// The AI's reading of a reply and its draft answer, or null when AI isn't set up on the server (or the call fails).
export async function fetchReplyDraft(req: ReplyRequest, signal?: AbortSignal): Promise<ReplyDraft | null> {
  try {
    const data = await post<ReplyDraftResponse>('reply', req, signal)
    return data.draft && typeof data.draft.intent === 'string' ? data.draft : null
  } catch (e) {
    if (signal?.aborted) throw e
    return null
  }
}

// Which alerts and CRMs the server has set up. All off when the server can't be reached.
export async function fetchIntegrations(signal?: AbortSignal): Promise<Integrations> {
  const off: Integrations = { slack: false, webhook: false, hubspot: false, ghl: false, places: false }
  try {
    const res = await fetch(`${BASE}/api/integrations`, { headers: accessHeaders(), signal })
    if (!res.ok || !res.headers.get('content-type')?.startsWith('application/json')) return off
    const d = (await res.json()) as Partial<Integrations>
    return { slack: d.slack === true, webhook: d.webhook === true, hubspot: d.hubspot === true, ghl: d.ghl === true, places: d.places === true }
  } catch {
    return off
  }
}

// Fire-and-forget alert; never throws.
export async function sendAlert(req: AlertRequest): Promise<void> {
  try {
    await post('integrations?op=notify', req)
  } catch {
    // alerts are best effort
  }
}

export async function syncCrm(leads: CrmLead[], signal?: AbortSignal): Promise<CrmResult> {
  return post<CrmResult>('integrations?op=crm', { leads }, signal)
}

export async function fetchReviews(req: ReviewsRequest, signal?: AbortSignal): Promise<Reviews> {
  const data = await post<{ reviews: Reviews }>('integrations?op=reviews', req, signal)
  return data.reviews
}
