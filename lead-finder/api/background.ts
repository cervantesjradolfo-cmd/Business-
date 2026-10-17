// POST /api/background: background mode for one profile.
//   { action: 'status', workspace }            is it set up on the server, is it on, last run
//   { action: 'sync', workspace, ...snapshot }  turn on / keep in step: merges your copy with the server's
//   { action: 'run', workspace }               run it now (check replies, send what is due)
//   { action: 'disable', workspace }           turn off: the server's copy and stored password are deleted
import { backgroundAvailable, disableWorkspace, runWorkspace, statusOf, syncWorkspace, validWorkspaceId } from '../server/background.js'
import { parseSyncRequest } from '../server/backgroundRequest.js'
import { checkAccess, json } from '../server/http.js'
import { KvError } from '../server/kv.js'

const NOT_SET_UP = 'Background mode isn\'t set up on the server. Add Upstash Redis and BACKGROUND_SECRET (see README, "Run while the app is closed").'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (!body || typeof body !== 'object') return json({ error: 'Bad request' }, 400)
  const workspace = body.workspace
  if (!validWorkspaceId(workspace)) return json({ error: 'Invalid profile' }, 400)
  try {
    if (body.action === 'status') return json(await statusOf(workspace))
    if (!backgroundAvailable()) return json({ error: NOT_SET_UP }, 400)
    if (body.action === 'sync') {
      const parsed = parseSyncRequest(body)
      if (!parsed.ok) return json({ error: parsed.error }, 400)
      const r = await syncWorkspace(parsed.value)
      return r === 'busy' ? json({ error: 'busy' }, 409) : json(r)
    }
    if (body.action === 'disable') {
      const r = await disableWorkspace(workspace)
      return r === 'busy' ? json({ error: 'busy' }, 409) : json(r)
    }
    if (body.action === 'run') {
      const note = await runWorkspace(workspace, Date.now() + 50_000)
      return note === 'busy' ? json({ error: 'busy' }, 409) : json({ note, ...(await statusOf(workspace)) })
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    if (err instanceof KvError) return json({ error: err.message }, 502)
    console.error('background error', err instanceof Error ? err.name : 'unknown')
    return json({ error: 'Server error' }, 500)
  }
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
