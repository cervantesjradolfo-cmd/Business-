#!/usr/bin/env node
// Deploys Lead Finder to Vercel so that only you can open it.
//
//   VERCEL_TOKEN=... LEADS_CONTACT_EMAIL=you@example.com node scripts/deploy-private.mjs
//
// What it does:
// 1. Links (or creates) the Vercel project "lead-finder" from this folder.
// 2. Turns on Vercel Authentication (Deployment Protection): visitors must be signed in
//    to your Vercel account, so the site is private to you.
// 3. Sets APP_ACCESS_KEY (generated if you don't pass one) as a second lock on the API,
//    plus LEADS_CONTACT_EMAIL and ANTHROPIC_API_KEY when they are set in your shell.
// 4. Deploys to production and checks that a signed-out request is refused.
//
// It prints the site URL and the access key once. Enter the key in the app under
// "Your details". Re-running it redeploys and keeps the existing access key.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const token = process.env.VERCEL_TOKEN
const project = process.env.VERCEL_PROJECT || 'lead-finder'
const scope = process.env.VERCEL_SCOPE // optional team slug

if (!token) {
  console.error('VERCEL_TOKEN is not set. Create one at https://vercel.com/account/tokens and add it to your environment.')
  process.exit(1)
}

const cli = (args, input) => {
  const full = ['--yes', 'vercel@latest', ...args, '--token', token, ...(scope ? ['--scope', scope] : [])]
  return execFileSync('npx', full, { cwd: root, input, encoding: 'utf8', stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'inherit'] }).trim()
}
const api = async (method, path, body) => {
  const url = new URL(`https://api.vercel.com${path}`)
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID)
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${data?.error?.message || 'unknown error'}`)
  return data
}

console.log(`Linking Vercel project "${project}"…`)
cli(['link', '--yes', '--project', project])
const link = JSON.parse(readFileSync(join(root, '.vercel', 'project.json'), 'utf8'))
if (link.orgId?.startsWith('team_') && !process.env.VERCEL_TEAM_ID) process.env.VERCEL_TEAM_ID = link.orgId

console.log('Turning on Vercel Authentication (only you can open the site)…')
await api('PATCH', `/v9/projects/${link.projectId}`, { ssoProtection: { deploymentType: 'all_except_custom_domains' } })

const existing = await api('GET', `/v9/projects/${link.projectId}/env`)
const has = (key) => (existing.envs || []).some((e) => e.key === key)
const setEnv = async (key, value) => {
  if (has(key)) await api('DELETE', `/v9/projects/${link.projectId}/env/${existing.envs.find((e) => e.key === key).id}`)
  await api('POST', `/v10/projects/${link.projectId}/env`, { key, value, type: 'encrypted', target: ['production', 'preview'] })
}

let accessKey = process.env.APP_ACCESS_KEY
if (accessKey) await setEnv('APP_ACCESS_KEY', accessKey)
else if (!has('APP_ACCESS_KEY')) { accessKey = randomBytes(18).toString('base64url'); await setEnv('APP_ACCESS_KEY', accessKey) }
if (process.env.LEADS_CONTACT_EMAIL) await setEnv('LEADS_CONTACT_EMAIL', process.env.LEADS_CONTACT_EMAIL)
else if (!has('LEADS_CONTACT_EMAIL')) console.warn('Warning: LEADS_CONTACT_EMAIL is not set. OpenStreetMap may refuse searches until you set it.')
if (process.env.ANTHROPIC_API_KEY) await setEnv('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY)

console.log('Deploying…')
const url = cli(['deploy', '--prod', '--yes']).split('\n').filter((l) => l.startsWith('https://')).pop()
if (!url) throw new Error('Deploy finished but no URL was printed.')

const probe = await fetch(url, { redirect: 'manual' })
const locked = probe.status === 401 || probe.status === 403 || (probe.status >= 300 && probe.status < 400 && /vercel\.com\/(login|sso)/.test(probe.headers.get('location') || ''))

console.log('')
console.log(`Lead Finder is live: ${url}`)
console.log(locked ? 'Private: signed-out visitors are refused. Open it while signed in to Vercel.' : `WARNING: a signed-out request got HTTP ${probe.status}. Check Deployment Protection in the Vercel dashboard.`)
if (accessKey) console.log(`Access key (enter it under "Your details"; shown once): ${accessKey}`)
else console.log('Access key: unchanged (already set on Vercel).')
if (existsSync(join(root, '.vercel'))) console.log('The .vercel/ folder links this checkout to the project; it is git-ignored.')
process.exit(locked ? 0 : 2)
