import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '@/types/cards'

/**
 * What actually goes on the wire when matches sync.
 *
 * This file exists because of one line. PostgREST turns a batch of rows into a
 * single INSERT, and a key that is absent from a row arrives as `null` rather
 * than taking the column default — so one match with no `updatedAt`, written by
 * an older version of the app, failed the whole push with `null value in column
 * "updated_at" of relation "matches" violates not-null constraint`.
 *
 * The payload is asserted rather than the outcome: a mock cannot reproduce a
 * not-null constraint, but it can prove nothing null is ever sent for a column
 * that has one.
 */

let upserted: Array<Record<string, unknown>> = []

vi.mock('./supabase', () => {
  const rows = (table: string) =>
    table === 'games'
      ? [{ id: 'game-uuid', slug: 'brisca' }]
      : [{ id: 'deck-uuid', slug: 'espanola-40' }]

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: (table: string) => ({
        select: () => Promise.resolve({ data: rows(table), error: null }),
        upsert: (payload: Array<Record<string, unknown>>) => {
          upserted = payload
          return Promise.resolve({ error: null })
        },
      }),
    },
  }
})

const { pushMatches } = await import('./matchCloud')

const match = (over: Partial<Match> = {}): Match =>
  ({
    id: 'match-1',
    gameSlug: 'brisca',
    playerCount: 2,
    deckSlugs: ['espanola-40'],
    playerNames: ['Ana', 'Luis'],
    notes: '',
    tally: [],
    startedAt: '2025-06-01T20:00:00.000Z',
    updatedAt: '2025-06-02T20:00:00.000Z',
    ...over,
  }) as Match

beforeEach(() => {
  upserted = []
})

describe('pushMatches', () => {
  it('manda la partida con sus identificadores traducidos', async () => {
    await pushMatches('me', [match()], new Set())

    expect(upserted).toHaveLength(1)
    expect(upserted[0]).toMatchObject({
      id: 'match-1',
      profile_id: 'me',
      game_id: 'game-uuid',
      deck_ids: ['deck-uuid'],
      updated_at: '2025-06-02T20:00:00.000Z',
    })
  })

  it('nunca manda null en una columna not null, ni con una partida vieja', async () => {
    // lo que devuelve localStorage escrito por una version anterior
    const old = match({ updatedAt: undefined as unknown as string })
    await pushMatches('me', [old], new Set())

    const row = upserted[0]!
    expect(row.updated_at).toBe('2025-06-01T20:00:00.000Z')
    for (const column of ['updated_at', 'started_at', 'player_names', 'tally', 'notes']) {
      expect(row[column], column).not.toBeNull()
      expect(row[column], column).not.toBeUndefined()
    }
  })

  it('todas las filas llevan las mismas claves, que es lo que PostgREST exige', async () => {
    await pushMatches(
      'me',
      [match(), match({ id: 'match-2', updatedAt: undefined as unknown as string })],
      new Set(),
    )

    expect(upserted).toHaveLength(2)
    expect(Object.keys(upserted[1]!).sort()).toEqual(Object.keys(upserted[0]!).sort())
  })

  it('un grupo que no existe en la cuenta viaja como null, no rompe la clave ajena', async () => {
    await pushMatches('me', [match({ groupId: 'solo-en-el-movil' })], new Set())
    expect(upserted[0]!.group_id).toBeNull()

    await pushMatches('me', [match({ groupId: 'esta-en-la-cuenta' })], new Set(['esta-en-la-cuenta']))
    expect(upserted[0]!.group_id).toBe('esta-en-la-cuenta')
  })

  it('una partida de un juego que ya no esta en el catalogo no se manda', async () => {
    await pushMatches('me', [match({ gameSlug: 'un-juego-borrado' })], new Set())
    expect(upserted).toHaveLength(0)
  })
})
