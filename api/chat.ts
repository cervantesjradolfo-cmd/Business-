// Serverless chat endpoint for the Bounce Bot widget (Vercel: deploys automatically
// from the /api folder). Needs the ANTHROPIC_API_KEY environment variable.
// Streams the reply back as plain text.

import Anthropic from '@anthropic-ai/sdk'
import { MAX_CHARS, MAX_TURNS, SYSTEM_PROMPT } from '../src/lib/knowledge'

const client = new Anthropic()

type Turn = { role: 'user' | 'assistant'; content: string }

function cleanHistory(body: unknown): Turn[] | null {
  const raw = (body as { messages?: unknown })?.messages
  if (!Array.isArray(raw) || raw.length === 0) return null
  const turns = raw
    .slice(-MAX_TURNS)
    .filter(
      (t): t is Turn =>
        (t?.role === 'user' || t?.role === 'assistant') && typeof t?.content === 'string',
    )
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CHARS) }))
  // The API needs the conversation to start and end on a visitor message
  while (turns.length && turns[0].role !== 'user') turns.shift()
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null
  return turns
}

export async function POST(request: Request): Promise<Response> {
  let messages: Turn[] | null
  try {
    messages = cleanHistory(await request.json())
  } catch {
    messages = null
  }
  if (!messages) return new Response('Bad request', { status: 400 })

  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 1024,
    output_config: { effort: 'low' },
    // If the model declines, the API retries on a fallback model automatically
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  })

  // Surface setup problems (missing key, bad model) as a clean error so the
  // widget falls back to its offline answers instead of a half-empty reply.
  try {
    await stream.withResponse()
  } catch (err) {
    console.error('chat error', err)
    return new Response('Chat is unavailable', { status: 503 })
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on('text', (delta) => controller.enqueue(encoder.encode(delta)))
      stream
        .finalMessage()
        .then((msg) => {
          if (msg.stop_reason === 'refusal')
            controller.enqueue(
              encoder.encode("Sorry, I can't help with that. Is there anything about our rentals I can answer?"),
            )
          controller.close()
        })
        .catch((err: unknown) => {
          console.error('chat error', err)
          controller.error(err)
        })
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
