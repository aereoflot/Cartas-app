import type { Deck, DeckRequirement, Game, Locale, RulesSection } from '@/types/cards'
import type { DeckRow, GameRow, GameTextRow } from '@/types/db'
import { supabase } from './supabase'
import { SAMPLE_GAMES, gameBySlug } from './sampleGames'
import { STANDARD_DECKS, deckBySlug } from './decks'

/**
 * The catalogue, from Postgres when a Supabase project is configured and from the
 * bundled sample files otherwise. Every page goes through here, so the app is
 * explorable with no backend and identical in shape once there is one.
 */

const GAME_COLUMNS = `
  id, slug, players_min, players_max, players_best, supports_teams, team_size,
  deck_count_total, missing_cards_policy, missing_cards_note, duration_min, duration_max,
  complexity, age_min, requires_extras, mechanics, adult_only, rating_avg, rating_count,
  primary_locale,
  author:profiles!games_author_id_fkey(username, display_name),
  texts:game_texts(locale, title, tagline, summary, sections),
  decks:game_decks(quantity, cards_removed, note, deck:decks(slug, name, card_count))
`

// `parent:parent_deck_id(...)` embeds through the foreign key column. For a table
// that points at itself, PostgREST cannot resolve the constraint name as a hint
// (`decks!decks_parent_deck_id_fkey` is rejected) and `decks!parent_deck_id`
// resolves the wrong way round, returning an array. Verified against the live
// project; see scripts/check-remote.mjs.
const DECK_COLUMNS = `
  id, slug, name, name_i18n, description, kind, card_count, suits, ranks, extras,
  parent:parent_deck_id(slug)
`

/** Prefer the reader's language, then the game's own, then whatever exists. */
function pickText(rows: GameTextRow[], locale: Locale, primary: string): GameTextRow | undefined {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === primary) ??
    rows[0]
  )
}

/** Exported for the mapper tests: this is where every nullable column lands. */
export function mapGame(row: GameRow, locale: Locale): Game | null {
  const text = pickText(row.texts ?? [], locale, row.primary_locale)
  // a game with no text in any language has nothing to show
  if (text === undefined) return null

  const decks: DeckRequirement[] = (row.decks ?? []).map((d) => ({
    deckSlug: d.deck?.slug ?? '',
    quantity: d.quantity,
    ...(d.deck !== null ? { deckName: d.deck.name, deckCardCount: d.deck.card_count } : {}),
    ...(d.cards_removed !== null && d.cards_removed.length > 0
      ? { cardsRemoved: d.cards_removed }
      : {}),
    ...(d.note !== null ? { note: d.note } : {}),
  }))

  return {
    id: row.id,
    slug: row.slug,
    title: text.title,
    summary: text.summary,
    sections: (text.sections ?? []) as RulesSection[],
    playersMin: row.players_min,
    playersMax: row.players_max,
    supportsTeams: row.supports_teams,
    decks,
    deckCountTotal: row.deck_count_total,
    missingCardsPolicy: row.missing_cards_policy,
    requiresExtras: row.requires_extras ?? [],
    mechanics: row.mechanics ?? [],
    adultOnly: row.adult_only,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    ...(text.tagline !== null ? { tagline: text.tagline } : {}),
    ...(row.author !== null ? { authorName: row.author.display_name } : {}),
    ...(row.players_best !== null ? { playersBest: row.players_best } : {}),
    ...(row.team_size !== null ? { teamSize: row.team_size } : {}),
    ...(row.missing_cards_note !== null ? { missingCardsNote: row.missing_cards_note } : {}),
    ...(row.duration_min !== null ? { durationMin: row.duration_min } : {}),
    ...(row.duration_max !== null ? { durationMax: row.duration_max } : {}),
    ...(row.complexity !== null ? { complexity: row.complexity } : {}),
    ...(row.age_min !== null ? { ageMin: row.age_min } : {}),
  }
}

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

export async function fetchGames(locale: Locale): Promise<Game[]> {
  if (supabase === null) return SAMPLE_GAMES

  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('listed', true)
    .order('rating_avg', { ascending: false })

  if (error !== null) throw new Error(error.message)
  return (data as unknown as GameRow[])
    .map((row) => mapGame(row, locale))
    .filter((g): g is Game => g !== null)
}

export async function fetchGame(slug: string, locale: Locale): Promise<Game | null> {
  if (supabase === null) return gameBySlug(slug) ?? null

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
