// One HTTP(S) GET that can only connect to addresses we checked.
// fetch() resolves DNS on its own, so checking the host first and fetching second can be fooled
// (DNS rebinding). Here the socket's own `lookup` does the check and hands the checked address
// to the socket, so there is no second resolution.
import { lookup as dnsLookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { Readable } from 'node:stream'
import { isBlockedHostname, isPrivateIp } from '../src/lib/url.js'

export class Blocked extends Error {}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void

export function safeLookup(hostname: string, options: { all?: boolean } | number | undefined, callback: LookupCb): void {
  const all = typeof options === 'object' && options !== null && options.all === true
  dnsLookup(hostname, { all: true }).then(
    (addrs) => {
      if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) return callback(new Blocked('Address not allowed'))
      if (all) callback(null, addrs)
      else callback(null, addrs[0].address, addrs[0].family)
    },
    (err) => callback(err as NodeJS.ErrnoException),
  )
}

// Synchronous checks that do not need DNS (names are checked by safeLookup at connect time).
export function checkUrl(u: URL): void {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Blocked()
  if (isBlockedHostname(u.hostname)) throw new Blocked()
}

export function safeGet(url: URL, opts: { headers: Record<string, string>; signal: AbortSignal }): Promise<Response> {
  checkUrl(url)
  return new Promise<Response>((resolve, reject) => {
    const secure = url.protocol === 'https:'
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const req = (secure ? https : http).request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: opts.headers,
        lookup: safeLookup as unknown as net.LookupFunction,
        ...(secure && !net.isIP(hostname) ? { servername: hostname } : {}),
        signal: opts.signal,
        agent: false,
      },
      (res) => {
        const headers = new Headers()
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue
          try {
            headers.set(k, Array.isArray(v) ? v.join(', ') : v)
          } catch {
            // skip a malformed header
          }
        }
        const status = res.statusCode ?? 0
        if (status < 200 || status > 599) {
          res.resume()
          return reject(new Error('Bad status'))
        }
        const noBody = status === 204 || status === 205 || status === 304
        if (noBody) res.resume()
        resolve(new Response(noBody ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>), { status, headers }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}
