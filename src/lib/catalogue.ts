import type { Deck, Game, Locale } from '@/types/cards'
import type { DeckRow, GameRow } from '@/types/db'
import { supabase } from './supabase'
import { SAMPLE_GAMES, gameBySlug } from './sampleGames'
import { STANDARD_DECKS, deckBySlug } from './decks'
import { fetchPublishedGame, fetchPublishedGames } from './published'
import { GAME_COLUMNS, mapGame } from './gameMap'

// re-exported: the mapper tests and the snapshot writer both ask for it here
export { GAME_COLUMNS, mapGame }

// `parent:parent_deck_id(...)` embeds through the foreign key column. For a table
// that points at itself, PostgREST cannot resolve the constraint name as a hint
// (`decks!decks_parent_deck_id_fkey` is rejected) and `decks!parent_deck_id`
// resolves the wrong way round, returning an array. Verified against the live
// project; see scripts/check-remote.mjs.
const DECK_COLUMNS = `
  id, slug, name, name_i18n, description, kind, card_count, suits, ranks, extras,
  parent:parent_deck_id(slug)
`


/**
 * The catalogue, from Postgres when a Supabase project is configured and from the
 * bundled sample files otherwise. Every page goes through here, so the app is
 * explorable with no backend and identical in shape once there is one.
 */

/** Exported for the mapper tests. */
export function mapDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    suits: (row.suits ?? []) as Deck['suits'],
    ranks: (row.ranks ?? []) as Deck['ranks'],
    extras: (row.extras ?? []) as Deck['extras'],
    cardCount: row.card_count,
    ...(row.name_i18n !== null ? { name_i18n: row.name_i18n as Deck['name_i18n'] } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.parent !== null ? { parentSlug: row.parent.slug } : {}),
  }
}

/**
 * The public catalogue: the approved, frozen version of every published game.
 *
 * It reads `game_versions`, not `games`. The author's row is their working
 * copy — they can edit it, send it back for review or hide it — and none of
 * that may take a game off the shelf for everybody who is already playing it.
 * See src/lib/published.ts.
 */
export async function fetchGames(locale: Locale): Promise<Game[]> {
  if (supabase === null) return SAMPLE_GAMES
  return fetchPublishedGames(locale)
}

/**
 * One game by its address.
 *
 * The published version first, because that is what a reader is asking for and
 * what a shared link points at. Falling back to the author's own row is what
 * lets an author (and a reviewer) open a game that is not published yet — RLS
 * decides whether they may, so there is nothing to check here.
 */
export async function fetchGame(slug: string, locale: Locale): Promise<Game | null> {
  if (supabase === null) return gameBySlug(slug) ?? null

  const published = await fetchPublishedGame(slug, locale)
  if (published !== null) return published

  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error !== null) throw new Error(error.message)
  if (data === null) return null
  return mapGame(data as unknown as GameRow, locale)
}

export async function fetchDecks(): Promise<Deck[]> {
  if (supabase === null) return STANDARD_DECKS

  const { data, error } = await supabase.from('decks').select(DECK_COLUMNS).order('card_count')
  if (error !== null) throw new Error(error.message)
  return (data as unknown as DeckRow[]).map(mapDeck)
}

export async function fetchDeck(slug: string): Promise<Deck | null> {
  if (supabase === null) return deckBySlug(slug) ?? null

  const { data, error } = await supabase
    .from('decks')
    .select(DECK_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error !== null) throw new Error(error.message)
  return data === null ? null : mapDeck(data as unknown as DeckRow)
}

/**
 * The review queue: games waiting for the owner, oldest submission first.
 * Reuses the same columns and the same mapper as the public catalogue, so a
 * reviewer sees exactly what a reader would see — which is the whole point of
 * the queue being a read rather than an investigation.
 */
export async function fetchPendingGames(locale: Locale): Promise<Game[]> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: true })

  if (error !== null) throw new Error(error.message)
  return (data as unknown as GameRow[])
    .map((row) => mapGame(row, locale))
    .filter((game): game is Game => game !== null)
}

export interface MyGame {
  game: Game
  status: string
}

/**
 * The author's own games that are not published yet: drafts and anything
 * waiting for review. The point is that submitting a game does not take it away
 * from you — you can read it, and play from it, while it sits in the queue.
 *
 * `games_read` already allows `author_id = auth.uid()`, so this needs no
 * special privilege; it is the same catalogue, asked a different question.
 */
export async function fetchMyUnpublishedGames(
  locale: Locale,
  authorId: string,
): Promise<MyGame[]> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('games')
    .select(`status, ${GAME_COLUMNS}`)
    .eq('author_id', authorId)
    .neq('status', 'published')
    .order('updated_at', { ascending: false })

  if (error !== null) throw new Error(error.message)

  return (data as unknown as Array<GameRow & { status: string }>)
    .map((row) => {
      const game = mapGame(row, locale)
      return game === null ? null : { game, status: row.status }
    })
    .filter((mine): mine is MyGame => mine !== null)
}
