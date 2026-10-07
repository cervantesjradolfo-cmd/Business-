import { buildTemplatePitch } from './pitch'
import { getAccessKey } from './storage'
import type { AuditResult, Pitch, PitchRequest, ProjectsRequest, ProjectsResponse, SearchRequest, SearchResponse, SendRequest, SendResult } from './types'

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

export function searchLeads(req: SearchRequest, signal?: AbortSignal): Promise<SearchResponse> {
  return post<SearchResponse>('search', req, signal)
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
