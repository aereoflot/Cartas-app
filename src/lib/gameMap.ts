import type { Game, Locale, DeckRequirement, RulesSection } from '@/types/cards'
import type { GameRow, GameTextRow } from '@/types/db'

/**
 * One game, from a database row to the shape every screen uses.
 *
 * It lives apart from `catalogue.ts` because two things read games now: the
 * public catalogue, which reads the frozen `game_versions` snapshots, and the
 * author's own view, which reads `games` directly. Both go through this, so
 * there is one place where a nullable column becomes an absent property — and
 * importing it from both no longer means a cycle.
 */

export const GAME_COLUMNS = `
  id, slug, players_min, players_max, players_best, supports_teams, team_size,
  deck_count_total, missing_cards_policy, missing_cards_note, duration_min, duration_max,
  complexity, age_min, requires_extras, mechanics, adult_only, rating_avg, rating_count,
  primary_locale,
  author:profiles!games_author_id_fkey(username, display_name),
  texts:game_texts(locale, title, tagline, summary, sections),
  decks:game_decks(quantity, cards_removed, note, deck:decks(slug, name, card_count))
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
    textLocale: (text.locale === 'en' ? 'en' : 'es') as Locale,
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
