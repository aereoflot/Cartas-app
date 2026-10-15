import type { Match, TallyEntry } from '@/types/cards'
import { supabase } from './supabase'

/**
 * Matches in Postgres. The id comes from the device, so a match is the same row
 * everywhere and syncing is an upsert rather than a reconciliation.
 *
 * The app speaks slugs and the database keys on uuids, so both directions
 * translate through small lookup maps. `group_id` is only sent when the group
 * actually exists on the account: a group made on a phone with no account has a
 * local id that no row would match, and the foreign key would reject the whole
 * upsert.
 */

interface MatchRow {
  id: string
  profile_id: string
  game_id: string
  player_count: number
  deck_ids: string[] | null
  player_names: string[] | null
  notes: string | null
  tally: TallyEntry[] | null
  stake: string | null
  group_id: string | null
  started_at: string
  ended_at: string | null
  updated_at: string
}

async function slugMaps(): Promise<{
  gameIdBySlug: Map<string, string>
  gameSlugById: Map<string, string>
  deckIdBySlug: Map<string, string>
  deckSlugById: Map<string, string>
}> {
  if (supabase === null) {
    return {
      gameIdBySlug: new Map(),
      gameSlugById: new Map(),
      deckIdBySlug: new Map(),
      deckSlugById: new Map(),
    }
  }

  const [games, decks] = await Promise.all([
    supabase.from('games').select('id, slug'),
    supabase.from('decks').select('id, slug'),
  ])
  for (const result of [games, decks]) {
    if (result.error !== null) throw new Error(result.error.message)
  }

  type Row = { id: string; slug: string }
  const gameRows = games.data as Row[]
  const deckRows = decks.data as Row[]

  return {
    gameIdBySlug: new Map(gameRows.map((row) => [row.slug, row.id])),
    gameSlugById: new Map(gameRows.map((row) => [row.id, row.slug])),
    deckIdBySlug: new Map(deckRows.map((row) => [row.slug, row.id])),
    deckSlugById: new Map(deckRows.map((row) => [row.id, row.slug])),
  }
}

export async function pullMatches(userId: string): Promise<Match[]> {
  if (supabase === null) return []

  const [{ data, error }, maps] = await Promise.all([
    supabase
      .from('matches')
      .select(
        'id, profile_id, game_id, player_count, deck_ids, player_names, notes, tally,' +
          ' stake, group_id, started_at, ended_at, updated_at',
      )
      .eq('profile_id', userId)
      .order('started_at', { ascending: false }),
    slugMaps(),
  ])
  if (error !== null) throw new Error(error.message)

  return (data as unknown as MatchRow[])
    .map((row): Match | null => {
      const gameSlug = maps.gameSlugById.get(row.game_id)
      // a match for a game that is gone from the catalogue has nothing to show
      if (gameSlug === undefined) return null

      return {
        id: row.id,
        gameSlug,
        playerCount: row.player_count,
        deckSlugs: (row.deck_ids ?? [])
          .map((id) => maps.deckSlugById.get(id))
          .filter((slug): slug is string => slug !== undefined),
        playerNames: row.player_names ?? [],
        notes: row.notes ?? '',
        tally: row.tally ?? [],
        startedAt: row.started_at,
        updatedAt: row.updated_at,
        ...(row.stake !== null ? { stake: row.stake } : {}),
        ...(row.group_id !== null ? { groupId: row.group_id } : {}),
        ...(row.ended_at !== null ? { endedAt: row.ended_at } : {}),
      }
    })
    .filter((match): match is Match => match !== null)
}

export async function pushMatches(
  userId: string,
  matches: Match[],
  accountGroupIds: Set<string>,
): Promise<void> {
  if (supabase === null || matches.length === 0) return

  const maps = await slugMaps()

  const rows = matches
    .map((match) => {
      const gameId = maps.gameIdBySlug.get(match.gameSlug)
      if (gameId === undefined) return null

      return {
        id: match.id,
        profile_id: userId,
        game_id: gameId,
        player_count: match.playerCount,
        deck_ids: match.deckSlugs
          .map((slug) => maps.deckIdBySlug.get(slug))
          .filter((id): id is string => id !== undefined),
        player_names: match.playerNames ?? [],
        notes: match.notes ?? '',
        tally: match.tally ?? [],
        stake: match.stake ?? null,
        group_id:
          match.groupId !== undefined && accountGroupIds.has(match.groupId)
            ? match.groupId
            : null,
        started_at: match.startedAt,
        ended_at: match.endedAt ?? null,
        // Not `match.updatedAt` on its own. PostgREST builds one INSERT for the
        // whole batch, so a key that is absent from a row arrives as null
        // instead of taking the column default — and `updated_at` is not null.
        // One match written by an older version of the app, with no timestamp,
        // was enough to fail the push for everything.
        updated_at: match.updatedAt ?? match.startedAt,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (rows.length === 0) return

  const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'id' })
  if (error !== null) throw new Error(error.message)
}
