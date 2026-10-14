import { supabase } from './supabase'

/**
 * Talking to the expert. The model is never called from here: the browser calls
 * our own edge function, which holds the Anthropic key. A key in a browser is a
 * key anybody can spend.
 *
 * The answer arrives as a stream, so the first words show up while the rest is
 * still being written.
 */

export type AiMode = 'explain' | 'referee' | 'suggest' | 'author'
export type Register = 'kid' | 'quick' | 'example' | 'compare'

export interface AiAsk {
  mode: AiMode
  gameSlug?: string
  question?: string
  register?: Register
  players?: number
  minutes?: number
  deckSlugs?: string[]
}

/** Problems worth their own sentence on screen, rather than a raw status code. */
export type AiProblem =
  | 'not-configured'
  | 'not-deployed'
  | 'no-api-key'
  | 'sign-in-required'
  | 'monthly-limit'
  | 'game-not-found'
  | 'question-required'
  | 'unknown'

export class AiError extends Error {
  constructor(readonly problem: AiProblem, message?: string) {
    super(message ?? problem)
    this.name = 'AiError'
  }
}

const problemFor = (status: number, body: string): AiProblem => {
  if (status === 404) return 'not-deployed'
  if (status === 401) return 'sign-in-required'
  if (status === 429) return 'monthly-limit'
  if (body.includes('no-api-key')) return 'no-api-key'
  if (body.includes('game-not-found')) return 'game-not-found'
  if (body.includes('question-required')) return 'question-required'
  return 'unknown'
}

export async function askExpert(ask: AiAsk, onChunk: (text: string) => void): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (supabase === null || url === undefined || url === '') {
    throw new AiError('not-configured')
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token === undefined) throw new AiError('sign-in-required')

  const response = await fetch(`${url}/functions/v1/ai-expert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(ask),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new AiError(problemFor(response.status, body), body)
  }

  const reader = response.body?.getReader()
  if (reader === undefined) throw new AiError('unknown')

  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}
