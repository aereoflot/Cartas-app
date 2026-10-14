import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computedCardCount } from '@/types/cards'
import { STANDARD_DECKS } from './decks'

describe('standard decks', () => {
  it.each(STANDARD_DECKS.map((d) => [d.slug, d] as const))(
    '%s: card_count matches its structure',
    (_slug, deck) => {
      expect(computedCardCount(deck)).toBe(deck.cardCount)
    },
  )

  it('has a parent for every variant', () => {
    for (const deck of STANDARD_DECKS) {
      if (deck.kind === 'variant') {
        expect(deck.parentSlug).toBeDefined()
        expect(STANDARD_DECKS.some((d) => d.slug === deck.parentSlug)).toBe(true)
      }
    }
  })

  /**
   * The TS definitions and the SQL seed are two copies of the same fact until
   * Supabase is wired up and the TS copy disappears. Until then, pin them
   * together: a deck that drifts here is a deck the app renders wrong.
   */
  it('agrees with the SQL seed on every card count', () => {
    const sql = readFileSync('supabase/migrations/0002_standard_decks.sql', 'utf8')
    const fromSql = new Map<string, number>()
    for (const m of sql.matchAll(/values \('[^']+', '([a-z0-9-]+)'[\s\S]*?\n\s+(\d+)\)\non conflict/g)) {
      fromSql.set(m[1] as string, Number(m[2]))
    }
    expect(fromSql.size).toBeGreaterThanOrEqual(8)
    for (const deck of STANDARD_DECKS) {
      expect(fromSql.get(deck.slug), `${deck.slug} missing from the SQL seed`).toBe(
        deck.cardCount,
      )
    }
  })
})
