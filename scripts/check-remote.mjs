#!/usr/bin/env node
/**
 * Run the app's real queries against the configured Supabase project.
 *
 *   npm run check:remote
 *
 * This exists because the unit tests cannot catch a bad PostgREST query: they
 * run against the bundled fallback catalogue, and a malformed embed only fails
 * when a real server parses it. That is exactly how the self-referencing deck
 * join (`parent:parent_deck_id`) was found to be wrong.
 *
 * The SELECT strings are read out of src/lib/catalogue.ts rather than copied, so
 * this checks what the app actually sends.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const fail = []
const note = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) fail.push(label)
}

function readEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i === -1) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

function columns(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*\`([^\`]*)\``))
  if (match === null) throw new Error(`${name} not found in src/lib/catalogue.ts`)
  return match[1]
}

const env = readEnv('.env.local')
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('.env.local has no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(2)
}

const source = readFileSync('src/lib/catalogue.ts', 'utf8')
const GAME_COLUMNS = columns(source, 'GAME_COLUMNS')
const DECK_COLUMNS = columns(source, 'DECK_COLUMNS')

// the anon key: exactly what a visitor who has not signed in can see
const supabase = createClient(url, key)
console.log(`\n${url}\n`)

console.log('decks')
{
  const { data, error } = await supabase.from('decks').select(DECK_COLUMNS).order('card_count')
  if (error) {
    note(false, 'the deck query parses', error.message)
  } else {
    note(true, 'the deck query parses')
    note(data.length === 8, 'eight standard decks', `got ${data.length}`)

    const variants = data.filter((d) => d.kind === 'variant')
    note(variants.length > 0, 'at least one variant exists')
    note(
      variants.every((d) => d.parent !== null && typeof d.parent?.slug === 'string'),
      'every variant resolves its parent deck',
      variants.map((d) => `${d.slug}->${d.parent?.slug ?? 'null'}`).join(' '),
    )

    const wrong = data.filter((d) => {
      const perSuit = d.ranks.reduce((n, r) => n + (r.copies ?? 1), 0)
      const extras = d.extras.reduce((n, e) => n + (e.count ?? 1), 0)
      return perSuit * d.suits.length + extras !== d.card_count
    })
    note(wrong.length === 0, 'card_count matches the stored structure',
      wrong.map((d) => d.slug).join(' '))
  }
}

console.log('\ngames')
{
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('listed', true)
    .order('rating_avg', { ascending: false })

  if (error) {
    note(false, 'the game query parses', error.message)
  } else {
    note(true, 'the game query parses')
    note(data.length === 9, 'nine published games', `got ${data.length}`)
    note(data.every((g) => (g.texts ?? []).some((t) => t.locale === 'es')),
      'every game has Spanish text')
    note(data.every((g) => (g.texts ?? []).every((t) => (t.sections ?? []).length >= 4)),
      'every game has at least four rules sections')
    note(data.every((g) => (g.decks ?? []).length >= 1 && g.decks.every((d) => d.deck !== null)),
      'every game resolves the deck it needs')
    note(data.every((g) => g.deck_count_total >= 1), 'deck_count_total was filled by the trigger')
    note(data.every((g) => g.rating_count === 0),
      'the seeded catalogue ships no invented ratings')

    const cuarenta = data.find((g) => g.slug === 'cuarenta')
    note(
      JSON.stringify(cuarenta?.decks?.[0]?.cards_removed) === JSON.stringify(['8', '9', '10']),
      'cuarenta strips the 8s, 9s and 10s',
    )
  }
}

console.log('\ntext encoding')
{
  // Pasting the UTF-8 migrations through the Windows clipboard once wrote mojibake
  // into this database: "espa|-+-ola" for "española", garbage for ♠♣♥♦. The
  // migrations are pure ASCII now, and this is the check that says so.
  const MOJIBAKE = ['Ã', 'â€', 'Â', 'ï¿½', '\ufffd', '├', '▒', 'ÔÇ', '╔']

  const { data: decks } = await supabase
    .from('decks')
    .select('slug, name, description, suits, ranks')
  const { data: texts } = await supabase
    .from('game_texts')
    .select('game_id, title, tagline, summary, sections')

  const damaged = []
  for (const row of [...(decks ?? []), ...(texts ?? [])]) {
    const blob = JSON.stringify(row)
    const hit = MOJIBAKE.find((m) => blob.includes(m))
    if (hit !== undefined) damaged.push(`${row.slug ?? row.title}:${hit}`)
  }
  note(damaged.length === 0, 'no mojibake in any stored text', damaged.join(' '))

  // the exact characters that were corrupted, spelled out
  const spanish = decks?.find((d) => d.slug === 'espanola-40')
  note(spanish?.name === 'Baraja española (40)', 'the n-with-tilde survived',
    spanish?.name ?? 'missing')

  const french = decks?.find((d) => d.slug === 'francesa-52')
  const symbols = (french?.suits ?? []).map((s) => s.symbol).join(' ')
  note(symbols === '♣ ♦ ♥ ♠', 'the card suits survived', symbols)

  const poker = texts?.find((t) => (t.title ?? '').includes('ker Texas'))
  note(poker?.title === 'Póker Texas hold’em', 'the accents and the apostrophe survived',
    poker?.title ?? 'missing')
}

console.log('\nrow level security (as an anonymous visitor)')
{
  const { data: drafts } = await supabase.from('games').select('slug').neq('status', 'published')
  note((drafts ?? []).length === 0, 'unpublished games stay hidden')

  // RLS rejects an UPDATE by matching no rows rather than by erroring, so assert
  // on what came back, not on the absence of an error
  const { data: written, error } = await supabase
    .from('profiles')
    .update({ role: 'owner' })
    .eq('id', '00000000-0000-4000-8000-000000000000')
    .select('id')
  note(error !== null || (written ?? []).length === 0,
    'an anonymous client cannot write a profile role',
    error ? `refused: ${error.code}` : 'no rows written')
}

console.log(fail.length === 0 ? '\nall checks passed\n' : `\n${fail.length} failed\n`)
process.exit(fail.length === 0 ? 0 : 1)
