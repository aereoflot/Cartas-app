import { describe, expect, it } from 'vitest'
import type { DeckRow, GameRow } from '@/types/db'
import { mapDeck, mapGame } from './catalogue'

/**
 * These cover the seam between Postgres and the UI: nullable columns becoming
 * optional props, the joined deck, and which language a reader gets. Every one
 * of these was a `null` leaking into the page before.
 */

const row = (over: Partial<GameRow> = {}): GameRow => ({
  id: 'g1',
  slug: 'brisca',
  players_min: 2,
  players_max: 4,
  players_best: null,
  supports_teams: false,
  team_size: null,
  deck_count_total: 1,
  missing_cards_policy: 'strict',
  missing_cards_note: null,
  duration_min: null,
  duration_max: null,
  complexity: null,
  age_min: null,
  requires_extras: null,
  mechanics: null,
  adult_only: false,
  rating_avg: '4.50',
  rating_count: 2,
  primary_locale: 'es',
  author: null,
  texts: [{ locale: 'es', title: 'Brisca', tagline: null, summary: 'Resumen', sections: null }],
  decks: null,
  ...over,
})

describe('mapGame', () => {
  it('turns nulls into absent props, never into null', () => {
    const game = mapGame(row(), 'es')
    expect(game).not.toBeNull()
    expect(game?.tagline).toBeUndefined()
    expect(game?.playersBest).toBeUndefined()
    expect(game?.complexity).toBeUndefined()
    expect(game?.requiresExtras).toEqual([])
    expect(game?.mechanics).toEqual([])
    expect(game?.sections).toEqual([])
  })

  it('reads rating_avg as a number even though Postgres sends a string', () => {
    expect(mapGame(row(), 'es')?.ratingAvg).toBe(4.5)
  })

  it('prefers the reader language, then the game language, then anything', () => {
    const bilingual = row({
      primary_locale: 'es',
      texts: [
        { locale: 'es', title: 'Brisca', tagline: null, summary: 'Resumen', sections: null },
        { locale: 'en', title: 'Brisca (EN)', tagline: null, summary: 'Summary', sections: null },
      ],
    })
    expect(mapGame(bilingual, 'en')?.title).toBe('Brisca (EN)')
    expect(mapGame(bilingual, 'es')?.title).toBe('Brisca')

    // asked in English, only Spanish exists -> falls back to the game's own language
    expect(mapGame(row(), 'en')?.title).toBe('Brisca')

    // neither: whatever translation exists beats showing nothing
    const onlyFrenchish = row({
      primary_locale: 'es',
      texts: [{ locale: 'en', title: 'Only EN', tagline: null, summary: 'S', sections: null }],
    })
    expect(mapGame(onlyFrenchish, 'es')?.title).toBe('Only EN')
  })

  it('drops a game with no text in any language rather than rendering a blank', () => {
    expect(mapGame(row({ texts: [] }), 'es')).toBeNull()
    expect(mapGame(row({ texts: null }), 'es')).toBeNull()
  })

  it('carries the joined deck into the requirement', () => {
    const game = mapGame(
      row({
        decks: [
          {
            quantity: 2,
            cards_removed: ['8', '9'],
            note: 'sin ochos',
            deck: { slug: 'espanola-40', name: 'Baraja española (40)', card_count: 40 },
          },
        ],
      }),
      'es',
    )
    expect(game?.decks[0]).toEqual({
      deckSlug: 'espanola-40',
      quantity: 2,
      deckName: 'Baraja española (40)',
      deckCardCount: 40,
      cardsRemoved: ['8', '9'],
      note: 'sin ochos',
    })
  })

  it('omits an empty cards_removed array instead of carrying it', () => {
    const game = mapGame(
      row({ decks: [{ quantity: 1, cards_removed: [], note: null, deck: null }] }),
      'es',
    )
    expect(game?.decks[0]).toEqual({ deckSlug: '', quantity: 1 })
  })

  it('uses the author display name when there is one', () => {
    const game = mapGame(row({ author: { username: 'angel', display_name: 'Ángel' } }), 'es')
    expect(game?.authorName).toBe('Ángel')
  })
})

describe('mapDeck', () => {
  const deckRow = (over: Partial<DeckRow> = {}): DeckRow => ({
    id: 'd1',
    slug: 'francesa-54',
    name: 'Baraja francesa con comodines (54)',
    name_i18n: { en: 'French deck with jokers (54)' },
    description: null,
    kind: 'variant',
    card_count: 54,
    suits: [{ key: 'picas', name: 'Picas', symbol: '♠', color: 'black' }],
    ranks: [{ key: 'a', label: 'As', value: 1, order: 1 }],
    extras: [{ key: 'comodin', label: 'Comodín', count: 2 }],
    parent: { slug: 'francesa-52' },
    ...over,
  })

  it('keeps the parent slug for a variant', () => {
    expect(mapDeck(deckRow()).parentSlug).toBe('francesa-52')
  })

  it('leaves parent and description absent when null', () => {
    const deck = mapDeck(deckRow({ parent: null, description: null }))
    expect(deck.parentSlug).toBeUndefined()
    expect(deck.description).toBeUndefined()
  })

  it('defaults the JSONB structures to empty arrays', () => {
    const deck = mapDeck(deckRow({ suits: null, ranks: null, extras: null }))
    expect(deck.suits).toEqual([])
    expect(deck.ranks).toEqual([])
    expect(deck.extras).toEqual([])
  })
})
