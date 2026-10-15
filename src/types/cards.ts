/**
 * Domain types. These mirror the Postgres schema in supabase/migrations — see
 * docs/data-model.md. Once a Supabase project exists, the row types should be
 * generated from it; these stay as the hand-written shape of the JSONB columns
 * and of the joined view the UI actually consumes.
 */

export type Locale = 'es' | 'en'

export type SuitColor =
  | 'gold' | 'red' | 'blue' | 'green' | 'black' | 'brown' | 'yellow' | 'grey'

export type DeckKind = 'standard' | 'variant' | 'custom'

export type MissingCardsPolicy = 'strict' | 'tolerant' | 'irrelevant'

export interface Suit {
  key: string
  name: string
  name_i18n?: Partial<Record<Locale, string>>
  symbol: string
  color: SuitColor
}

export interface Rank {
  key: string
  label: string
  label_i18n?: Partial<Record<Locale, string>>
  value: number
  order: number
  /** how many of this rank exist per suit; 1 unless stated (an Uno deck has two) */
  copies?: number
}

export interface ExtraCards {
  key: string
  label: string
  label_i18n?: Partial<Record<Locale, string>>
  count: number
}

export interface Deck {
  id: string
  slug: string
  name: string
  name_i18n?: Partial<Record<Locale, string>>
  description?: string
  kind: DeckKind
  parentSlug?: string
  suits: Suit[]
  ranks: Rank[]
  extras: ExtraCards[]
  cardCount: number
}

/** A deck a game needs, and how much of it. */
export interface DeckRequirement {
  deckSlug: string
  quantity: number
  /** carried along when the row came from Postgres, where the deck is joined in */
  deckName?: string
  deckCardCount?: number
  cardsRemoved?: string[]
  note?: string
}

export interface RulesSection {
  heading: string
  body: string
}

export interface Game {
  id: string
  slug: string
  /**
   * The language this game's text is really in. Not the reader's language:
   * when a game has no text in theirs, they get the one that exists, and the
   * page has to be able to say so.
   */
  textLocale: Locale
  title: string
  tagline?: string
  summary: string
  sections: RulesSection[]
  authorName?: string
  playersMin: number
  playersMax: number
  playersBest?: number
  supportsTeams: boolean
  teamSize?: number
  decks: DeckRequirement[]
  deckCountTotal: number
  missingCardsPolicy: MissingCardsPolicy
  missingCardsNote?: string
  durationMin?: number
  durationMax?: number
  complexity?: number
  ageMin?: number
  requiresExtras: string[]
  mechanics: string[]
  adultOnly: boolean
  ratingAvg: number
  ratingCount: number
}

/** One played session. Lives in local storage first; syncs to `matches` later. */
export interface Match {
  id: string
  gameSlug: string
  playerCount: number
  deckSlugs: string[]
  playerNames: string[]
  notes: string
  tally: TallyEntry[]
  /** what is being played for, in the players' own words: "una cerveza" */
  stake?: string
  /** the group invited, so "our last matches" is a fact rather than a guess */
  groupId?: string
  startedAt: string
  endedAt?: string
  /** stamped by this device on every save; decides who wins a sync conflict */
  updatedAt: string
}

export interface TallyEntry {
  id: string
  label: string
  value: number
}

export const cardsPerSuit = (deck: Deck): number =>
  deck.ranks.reduce((n, r) => n + (r.copies ?? 1), 0)

export const computedCardCount = (deck: Deck): number =>
  cardsPerSuit(deck) * deck.suits.length +
  deck.extras.reduce((n, e) => n + e.count, 0)
