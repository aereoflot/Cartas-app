import type { Game, Locale } from '@/types/cards'
import type { GameRow } from '@/types/db'
import { GAME_COLUMNS, mapGame } from './gameMap'
import { supabase } from './supabase'

/**
 * The published catalogue: the frozen, approved version of every public game.
 *
 * Why this is a separate thing from `games`: a published game belonged to its
 * author's row, so the author could take it off the shelf by editing it (back
 * to the review queue) or by saving it privately. Somebody who found a game
 * last week would open the app and find it gone, because its author was
 * rewriting a sentence. Publishing is accepting that it is in the app, so the
 * approved version lives in `game_versions` and only a reviewer writes there.
 *
 * The snapshot holds the game in the same shape the catalogue query returns,
 * so `mapGame` reads both paths and there is one mapper to keep right. The
 * counters are *not* in it: a frozen rating would stop counting the day it was
 * approved, so they are read live from `games` and laid over the top.
 */

interface VersionRow {
  game_id: string
  slug: string
  version: number
  approved_at: string
  payload: Omit<GameRow, 'id' | 'slug' | 'rating_avg' | 'rating_count'>
  games: { rating_avg: number | string; rating_count: number } | null
}

const VERSION_COLUMNS = 'game_id, slug, version, approved_at, payload, games(rating_avg, rating_count)'

const toGame = (row: VersionRow, locale: Locale): Game | null =>
  mapGame(
    {
      ...row.payload,
      id: row.game_id,
      slug: row.slug,
      rating_avg: row.games?.rating_avg ?? 0,
      rating_count: row.games?.rating_count ?? 0,
    } as GameRow,
    locale,
  )

export async function fetchPublishedGames(locale: Locale): Promise<Game[]> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('game_versions')
    .select(VERSION_COLUMNS)
    .order('approved_at', { ascending: false })
  if (error !== null) throw new Error(error.message)

  return (data as unknown as VersionRow[])
    .map((row) => toGame(row, locale))
    .filter((game): game is Game => game !== null)
}

export async function fetchPublishedGame(slug: string, locale: Locale): Promise<Game | null> {
  if (supabase === null) return null

  const { data, error } = await supabase
    .from('game_versions')
    .select(VERSION_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error !== null) throw new Error(error.message)
  if (data === null) return null

  return toGame(data as unknown as VersionRow, locale)
}

/**
 * Freeze a game as its public version. Called when a reviewer approves, and
 * again on every re-approval, which bumps the version.
 *
 * The snapshot is taken by reading the game the same way the catalogue does,
 * so what gets frozen is exactly what the reviewer was looking at.
 */
export async function publishSnapshot(gameId: string, reviewerId: string): Promise<void> {
  if (supabase === null) return

  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('id', gameId)
    .single()
  if (error !== null) throw new Error(error.message)

  const row = data as unknown as GameRow
  const { id, slug, rating_avg, rating_count, ...payload } = row
  void rating_avg
  void rating_count

  const { data: current } = await supabase
    .from('game_versions')
    .select('version')
    .eq('game_id', id)
    .maybeSingle()
  const version = ((current as { version: number } | null)?.version ?? 0) + 1

  const { error: writeError } = await supabase.from('game_versions').upsert(
    {
      game_id: id,
      slug,
      version,
      payload,
      approved_at: new Date().toISOString(),
      approved_by: reviewerId,
    },
    { onConflict: 'game_id' },
  )
  if (writeError !== null) throw new Error(writeError.message)
}

/**
 * Take a published game down. A reviewer's act and nobody else's — it is the
 * answer to a report, and the only way out of the one-way door.
 *
 * The author's own row is left alone: their copy of their game is theirs, and
 * deleting it is a different decision from unpublishing it.
 */
export async function unpublishGame(gameId: string): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase.from('game_versions').delete().eq('game_id', gameId)
  if (error !== null) throw new Error(error.message)
}

/** Is this game on the public shelf? Used to word the editor's warning. */
export async function isPublished(gameId: string): Promise<boolean> {
  if (supabase === null) return false
  const { data } = await supabase
    .from('game_versions')
    .select('game_id')
    .eq('game_id', gameId)
    .maybeSingle()
  return data !== null
}
