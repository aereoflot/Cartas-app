// Cartas - the card-games expert.
//
// Runs on Supabase Edge Functions (Deno). It exists so the Anthropic key stays
// on a server: a key shipped to a browser is a key anybody can spend.
//
// Deploy:
//   supabase functions deploy ai-expert
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Four modes, and the difference between them is what the model is allowed to
// use as its source:
//
//   explain   the rules of one game, re-explained at a chosen register
//   referee   a question about a situation, answered ONLY from those rules,
//             saying plainly when the rules do not cover it
//   suggest   a recommendation chosen from a list of games this function looked
//             up itself, so it cannot recommend a game that does not exist
//   author    messy text turned into a draft the author then corrects
//
// The rules text goes in a cached system prompt, so a run of referee questions
// about the same game costs the full price once.

import Anthropic from 'npm:@anthropic-ai/sdk@0.134.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

const MODEL = 'claude-opus-5-5'
/** Messages per person per 30 days. A cap nobody notices, and a bill that cannot run away. */
const MONTHLY_LIMIT = 200

type Mode = 'explain' | 'referee' | 'suggest' | 'author'

interface Ask {
  mode: Mode
  gameSlug?: string
  question?: string
  /** explain only: who the explanation is for */
  register?: 'kid' | 'quick' | 'example' | 'compare'
  /** suggest only */
  players?: number
  minutes?: number
  deckSlugs?: string[]
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return fail(405, 'method-not-allowed')

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'no-api-key')

  const authorization = request.headers.get('Authorization')
  if (!authorization) return fail(401, 'sign-in-required')

  // the user's own token: every query below runs under their row level security,
  // so this function cannot read anything they could not read themselves
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )

  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return fail(401, 'sign-in-required')

  let ask: Ask
  try {
    ask = await request.json()
  } catch {
    return fail(400, 'bad-request')
  }
  if (!['explain', 'referee', 'suggest', 'author'].includes(ask.mode)) {
    return fail(400, 'bad-mode')
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('ai_messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  if ((count ?? 0) >= MONTHLY_LIMIT) return fail(429, 'monthly-limit')

  let system: string
  let question: string
  try {
    ;({ system, question } = await buildPrompt(supabase, ask))
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : 'bad-request')
  }

  const anthropic = new Anthropic({ apiKey })

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    // adaptive thinking, and effort set explicitly: this model defaults to
    // medium, and explaining a card game does not need more
    thinking: { type: 'adaptive' },
    output_config: { effort: ask.mode === 'referee' ? 'medium' : 'low' },
    // the rules are the long, repeated part of the prompt: cache them
    cache_control: { type: 'ephemeral' },
    system,
    messages: [{ role: 'user', content: question }],
  })

  const encoder = new TextEncoder()
  let answer = ''

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            answer += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await stream.finalMessage()
        await record(supabase, user.id, ask, question, answer, final.usage)
      } catch (error) {
        controller.enqueue(
          encoder.encode(`\n\n[${error instanceof Error ? error.message : 'error'}]`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
  })
})

interface GameText {
  title: string
  summary: string
  sections: Array<{ heading: string; body: string }> | null
}

async function rulesOf(
  supabase: ReturnType<typeof createClient>,
  slug: string,
): Promise<{ title: string; text: string }> {
  const { data, error } = await supabase
    .from('games')
    .select('slug, players_min, players_max, game_texts(title, summary, sections)')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) throw new Error('game-not-found')

  const row = data as unknown as {
    players_min: number
    players_max: number
    game_texts: GameText[]
  }
  const text = row.game_texts[0]
  if (!text) throw new Error('game-not-found')

  const sections = (text.sections ?? [])
    .map((section) => `## ${section.heading}\n${section.body}`)
    .join('\n\n')

  return {
    title: text.title,
    text: `# ${text.title}\nJugadores: ${row.players_min}-${row.players_max}\n\n` +
      `${text.summary}\n\n${sections}`,
  }
}

async function buildPrompt(
  supabase: ReturnType<typeof createClient>,
  ask: Ask,
): Promise<{ system: string; question: string }> {
  const voice =
    'Eres un experto en juegos de cartas que explica con calma y sin florituras. ' +
    'Respondes en el idioma en que te preguntan. No te inventes reglas.'

  if (ask.mode === 'explain') {
    if (!ask.gameSlug) throw new Error('game-required')
    const rules = await rulesOf(supabase, ask.gameSlug)
    const register = {
      kid: 'Explícaselo a alguien de siete años, con frases cortas.',
      quick: 'Explícalo en menos de un minuto de lectura: lo justo para empezar a jugar.',
      example: 'Explícalo narrando una mano de ejemplo, carta por carta.',
      compare: 'Explícalo comparándolo con otros juegos de cartas conocidos.',
    }[ask.register ?? 'quick']

    return {
      system: `${voice}\n\nEstas son las reglas tal y como están publicadas:\n\n${rules.text}`,
      question: `${register}\n\nNo añadas reglas que no estén arriba.`,
    }
  }

  if (ask.mode === 'referee') {
    if (!ask.gameSlug) throw new Error('game-required')
    if (!ask.question?.trim()) throw new Error('question-required')
    const rules = await rulesOf(supabase, ask.gameSlug)

    return {
      system:
        `${voice}\n\nHaces de árbitro de ${rules.title}. Respondes SOLO con lo que diga ` +
        'este texto. Si el texto no cubre la situación, dilo claramente y sugiere que lo ' +
        'acuerden en la mesa: no decidas tú una regla que no está escrita. Cita la sección ' +
        `en la que te apoyas.\n\n${rules.text}`,
      question: ask.question.trim(),
    }
  }

  if (ask.mode === 'suggest') {
    // the candidates come from the catalogue, so a recommendation can only ever
    // be a game that exists here
    let query = supabase
      .from('games')
      .select('slug, players_min, players_max, duration_min, complexity, game_texts(title, summary)')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .limit(40)

    if (ask.players) {
      query = query.lte('players_min', ask.players).gte('players_max', ask.players)
    }
    const { data, error } = await query
    if (error) throw new Error('catalogue-unavailable')

    const list = (data as unknown as Array<{
      slug: string
      players_min: number
      players_max: number
      duration_min: number | null
      complexity: number | null
      game_texts: Array<{ title: string; summary: string }>
    }>)
      .map((row) => {
        const title = row.game_texts[0]?.title ?? row.slug
        const summary = row.game_texts[0]?.summary ?? ''
        return `- ${title} (${row.slug}): ${row.players_min}-${row.players_max} jugadores, ` +
          `${row.duration_min ?? '?'} min, dificultad ${row.complexity ?? '?'}. ${summary}`
      })
      .join('\n')

    return {
      system:
        `${voice}\n\nSolo puedes recomendar juegos de esta lista, y nada más. Para cada uno ` +
        `que recomiendes, da una sola razón, concreta.\n\n${list}`,
      question:
        `Somos ${ask.players ?? 'varios'} jugadores, tenemos ` +
        `${ask.minutes ?? 'un rato'} minutos` +
        (ask.deckSlugs?.length ? ` y estas barajas: ${ask.deckSlugs.join(', ')}` : '') +
        `. ${ask.question?.trim() ?? '¿A qué jugamos?'} Recomienda dos o tres.`,
    }
  }

  if (!ask.question?.trim()) throw new Error('question-required')
  return {
    system:
      `${voice}\n\nTe dan unas reglas escritas de cualquier manera y las ordenas en las ` +
      'secciones de este repositorio: Objetivo, Preparación, Valor de las cartas, Desarrollo, ' +
      'Puntuación, Fin de la partida, Variantes. No inventes nada que no esté en el texto; si ' +
      'falta algo importante, dilo al final en una lista de "preguntas para el autor".',
    question: ask.question.trim(),
  }
}

async function record(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ask: Ask,
  question: string,
  answer: string,
  usage: { input_tokens?: number; output_tokens?: number },
): Promise<void> {
  const { data } = await supabase
    .from('ai_threads')
    .insert({ profile_id: userId, mode: ask.mode, title: ask.gameSlug ?? null })
    .select('id')
    .single()

  const threadId = (data as { id: string } | null)?.id
  if (!threadId) return

  await supabase.from('ai_messages').insert([
    { thread_id: threadId, role: 'user', content: question },
    {
      thread_id: threadId,
      role: 'assistant',
      content: answer,
      model: MODEL,
      input_tokens: usage.input_tokens ?? null,
      output_tokens: usage.output_tokens ?? null,
    },
  ])
}
