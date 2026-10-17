// GET /api/cron: the scheduled run. Checks replies and sends due emails for every profile in background
// mode. Needs CRON_SECRET: Vercel Cron sends it as "Authorization: Bearer <secret>", and so must any
// other scheduler (for example cron-job.org every 5 minutes).
import { timingSafeEqual } from 'node:crypto'
import { backgroundAvailable, runAll } from '../server/background.js'
import { json } from '../server/http.js'

function authorized(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim()
  if (secret.length < 16) return false
  const a = Buffer.from(request.headers.get('authorization') ?? '')
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401)
  if (!backgroundAvailable()) return json({ ran: [], note: 'Background mode is not set up' })
  try {
    return json({ ran: await runAll(Date.now() + 50_000) })
  } catch {
    return json({ error: 'Run failed' }, 500)
  }
}

export const POST = GET
