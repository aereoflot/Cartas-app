/**
 * Shapes returned by the PostgREST queries in src/lib/catalogue.ts. Narrower
 * than the full table rows on purpose: only the columns the UI selects.
 */
import type { DeckKind, MissingCardsPolicy, RulesSection } from './cards'

export interface GameTextRow {
  locale: string
  title: string
  tagline: string | null
  summary: string
  sections: RulesSection[] | null
}

export interface GameDeckRow {
  quantity: number
  cards_removed: string[] | null
  note: string | null
  deck: { slug: string; name: string; card_count: number } | null
}

export interface GameRow {
  id: string
  slug: string
  players_min: number
  players_max: number
  players_best: number | null
  supports_teams: boolean
  team_size: number | null
  deck_count_total: number
  missing_cards_policy: MissingCardsPolicy
  missing_cards_note: string | null
  duration_min: number | null
  duration_max: number | null
  complexity: number | null
  age_min: number | null
  requires_extras: string[] | null
  mechanics: string[] | null
  adult_only: boolean
  rating_avg: number | string
  rating_count: number
  primary_locale: string
  author: { username: string; display_name: string } | null
  texts: GameTextRow[] | null
  decks: GameDeckRow[] | null
}

export interface DeckRow {
  id: string
  slug: string
  name: string
  name_i18n: Record<string, string> | null
  description: string | null
  kind: DeckKind
  card_count: number
  suits: unknown
  ranks: unknown
  extras: unknown
  parent: { slug: string } | null
}
