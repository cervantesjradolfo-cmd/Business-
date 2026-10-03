// Vite dev middleware: mounts api/search|audit|pitch.ts so `npm run dev` needs no extra server.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const NAMES = new Set(['search', 'audit', 'pitch'])
const MAX_BODY = 1024 * 1024

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) return null
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

export function devApi(): Plugin {
  return {
    name: 'lead-finder-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()
        const name = url.slice('/api/'.length).split(/[?#]/)[0]
        if (!NAMES.has(name)) return sendJson(res, 404, { error: 'Not found' })
        try {
          const method = (req.method ?? 'GET').toUpperCase()
          let body: Buffer | undefined
          if (method !== 'GET' && method !== 'HEAD') {
            const b = await readBody(req)
            if (!b) return sendJson(res, 413, { error: 'Request too large' })
            body = b
          }
          const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<string, unknown>
          const handler = mod[method]
          if (typeof handler !== 'function') return sendJson(res, 405, { error: 'Method not allowed' })
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
            else if (v !== undefined) headers.set(k, v)
          }
          const request = new Request('http://localhost' + url, {
            method,
            headers,
            body: body ? new Uint8Array(body) : undefined,
          })
          const response: Response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          console.error('dev api error', err)
          sendJson(res, 500, { error: 'Server error' })
        }
      })
    },
  }
}
