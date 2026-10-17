// GET /api/integrations: which alerts and CRMs are set up on this server (yes/no only, never the secrets).
import { checkAccess, json } from '../server/http.js'
import { integrations } from '../server/integrations.js'

export async function GET(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  return json(integrations())
}

export async function POST(): Promise<Response> {
  return json({ error: 'Use GET' }, 405)
}
