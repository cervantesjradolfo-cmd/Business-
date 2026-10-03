import { localReply } from './localBot'
import { MAX_CHARS, MAX_TURNS, SYSTEM_PROMPT } from './knowledge'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

type SampleFn = (
  input: ChatTurn[],
  opts: {
    onText?: (e: { text: string }) => void
    signal?: AbortSignal
    modelTier?: 'quick' | 'default' | 'complex'
    cache?: boolean
  },
) => Promise<{ text: string }>

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> }
  }
}

// Where the AI backend lives. On Vercel/Netlify this is the function in /api.
// Set VITE_CHAT_ENDPOINT to point elsewhere, or to "off" to always use offline answers.
const ENDPOINT = import.meta.env.VITE_CHAT_ENDPOINT ?? '/api/chat'
let endpointDead = ENDPOINT === 'off'

// When the site is viewed as a Claude artifact, the viewer's own Claude can answer.
const samplePromise: Promise<SampleFn | null> =
  typeof window !== 'undefined' && window.claude
    ? window.claude.use('sample').then((s) => (s as SampleFn | null) ?? null, () => null)
    : Promise.resolve(null)
let sampleDead = false

const trim = (history: ChatTurn[]) =>
  history.slice(-MAX_TURNS).map((t) => ({ ...t, content: t.content.slice(0, MAX_CHARS) }))

async function viaSample(history: ChatTurn[], onText: (t: string) => void, signal: AbortSignal) {
  const sample = sampleDead ? null : await samplePromise
  if (!sample) return null
  // sample has no system prompt, so the instructions ride along in the first turn
  const turns = trim(history)
  turns[0] = { role: 'user', content: `${SYSTEM_PROMPT}\n\n---\nVisitor: ${turns[0].content}` }
  try {
    const { text } = await sample(turns, {
      signal,
      modelTier: 'quick',
      cache: false,
      onText: ({ text }) => onText(text),
    })
    return text
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'cancelled') throw e
    if (code === 'not_granted' || code === 'unavailable') sampleDead = true
    return null
  }
}

async function viaEndpoint(history: ChatTurn[], onText: (t: string) => void, signal: AbortSignal) {
  if (endpointDead) return null
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: trim(history) }),
      signal,
    })
  } catch (e) {
    if (signal.aborted) throw e
    return null
  }
  // A static host answers unknown paths with index.html or a 404: no backend here.
  if (!res.ok || !res.body || !res.headers.get('content-type')?.startsWith('text/plain')) {
    if (res.status === 404 || res.status === 405 || res.ok) endpointDead = true
    return null
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += value
      onText(text)
    }
  } catch (e) {
    if (signal.aborted) throw e
    // Backend failed mid-reply (e.g. missing API key): keep what arrived, else go offline
  }
  return text.trim() || null
}

/** Get the assistant's next reply, streaming partial text through onText. */
export async function askAssistant(
  history: ChatTurn[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const reply =
    (await viaSample(history, onText, signal)) ?? (await viaEndpoint(history, onText, signal))
  if (reply) return reply
  const last = history[history.length - 1]?.content ?? ''
  const text = localReply(last)
  onText(text)
  return text
}
