import type { CollectionState } from './merge'
import { supabase } from './supabase'

/**
 * Favourites and deck folders in Postgres.
 *
 * The app speaks in slugs; the database keys on uuids, so every call translates.
 * Pushing is a **replace**: whatever the account holds afterwards is exactly what
 * was passed in. That is what makes deleting work — a diff-and-add scheme would
 * leave removed rows behind forever — and the data is a handful of rows, so
 * replacing it costs nothing.
 */

interface IdRow {
  id: string
  slug: string
}

async function idsBySlug(table: 'games' | 'decks', slugs: string[]): Promise<Map<string, string>> {
  if (supabase === null || slugs.length === 0) return new Map()
  const { data, error } = await supabase.from(table).select('id, slug').in('slug', slugs)
  if (error !== null) throw new Error(error.message)
  return new Map((data as IdRow[]).map((row) => [row.slug, row.id]))
}

export async function pullCollections(userId: string): Promise<CollectionState> {
  if (supabase === null) {
    return {
      favoriteGames: [],
      favoriteDecks: [],
      folders: [],
      ownedDecks: [],
      hideAdult: false,
    }
  }

  const [games, decks, folders, owned, settings] = await Promise.all([
    supabase.from('game_favorites').select('game:games(slug)').eq('profile_id', userId),
    supabase.from('deck_favorites').select('deck:decks(slug)').eq('profile_id', userId),
    supabase
      .from('deck_folders')
      .select('id, name, position, deck_folder_decks(deck:decks(slug))')
      .eq('profile_id', userId)
      .order('position'),
    supabase.from('user_decks').select('deck:decks(slug)').eq('profile_id', userId),
    supabase
      .from('profile_settings')
      .select('hide_adult')
      .eq('profile_id', userId)
      .maybeSingle(),
  ])

  for (const result of [games, decks, folders, owned, settings]) {
    if (result.error !== null) throw new Error(result.error.message)
  }

  type SlugRef<K extends string> = Record<K, { slug: string } | null>
  type FolderRow = {
    id: string
    name: string
    deck_folder_decks: Array<SlugRef<'deck'>>
  }

  const slugsOf = <K extends string>(rows: unknown, key: K): string[] =>
    (rows as Array<SlugRef<K>>)
      .map((row) => row[key]?.slug)
      .filter((slug): slug is string => slug !== undefined)

  return {
    favoriteGames: slugsOf(games.data, 'game'),
    favoriteDecks: slugsOf(decks.data, 'deck'),
    ownedDecks: slugsOf(owned.data, 'deck'),
    hideAdult: (settings.data as { hide_adult: boolean } | null)?.hide_adult ?? false,
    folders: (folders.data as unknown as FolderRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      deckSlugs: slugsOf(row.deck_folder_decks, 'deck'),
    })),
  }
}

/** Make the account hold exactly `state`, and nothing else. */
export async function pushCollections(userId: string, state: CollectionState): Promise<void> {
  if (supabase === null) return

  const gameIds = await idsBySlug('games', state.favoriteGames)
  const allDeckSlugs = [
    ...state.favoriteDecks,
    ...state.ownedDecks,
    ...state.folders.flatMap((folder) => folder.deckSlugs),
  ]
  const deckIds = await idsBySlug('decks', allDeckSlugs)

  await replaceFavorites('game_favorites', 'game_id', userId, state.favoriteGames, gameIds)
  await replaceFavorites('deck_favorites', 'deck_id', userId, state.favoriteDecks, deckIds)
  await replaceFavorites('user_decks', 'deck_id', userId, state.ownedDecks, deckIds)
  await replaceFolders(userId, state, deckIds)

  const { error } = await supabase
    .from('profile_settings')
    .upsert({ profile_id: userId, hide_adult: state.hideAdult }, { onConflict: 'profile_id' })
  if (error !== null) throw new Error(error.message)
}

/**
 * Rows keyed on (profile_id, something_id) with nothing else to them: the
 * favourites and the deck inventory are the same shape, so they replace the same
 * way rather than twice.
 */
async function replaceFavorites(
  table: 'game_favorites' | 'deck_favorites' | 'user_decks',
  column: 'game_id' | 'deck_id',
  userId: string,
  slugs: string[],
  ids: Map<string, string>,
): Promise<void> {
  if (supabase === null) return
  const wanted = slugs.map((slug) => ids.get(slug)).filter((id): id is string => id !== undefined)

  if (wanted.length > 0) {
    const { error } = await supabase
      .from(table)
      .upsert(
        wanted.map((id) => ({ profile_id: userId, [column]: id })),
        { onConflict: `profile_id,${column}`, ignoreDuplicates: true },
      )
    if (error !== null) throw new Error(error.message)
  }

  // drop whatever is no longer starred; with nothing starred, drop everything
  const remove = supabase.from(table).delete().eq('profile_id', userId)
  const { error } = await (wanted.length === 0
    ? remove
    : remove.not(column, 'in', `(${wanted.join(',')})`))
  if (error !== null) throw new Error(error.message)
}

async function replaceFolders(
  userId: string,
  state: CollectionState,
  deckIds: Map<string, string>,
): Promise<void> {
  if (supabase === null) return

  const names = state.folders.map((folder) => folder.name)

  if (names.length > 0) {
    const { error } = await supabase.from('deck_folders').upsert(
      state.folders.map((folder, index) => ({
        profile_id: userId,
        name: folder.name,
        position: index,
      })),
      { onConflict: 'profile_id,name' },
    )
    if (error !== null) throw new Error(error.message)
  }

  // read the ids back: upsert does not say which rows already existed
  const { data, error } = await supabase
    .from('deck_folders')
    .select('id, name')
    .eq('profile_id', userId)
  if (error !== null) throw new Error(error.message)

  const stored = data as Array<{ id: string; name: string }>
  const folderIdByName = new Map(stored.map((row) => [row.name, row.id]))

  // Delete by id, never by name. A folder name is text the person typed, and
  // interpolating it into a PostgREST filter let a name containing a quote or a
  // comma change which rows the filter matched. Ids are uuids: nothing to escape.
  const keepIds = names
    .map((name) => folderIdByName.get(name))
    .filter((id): id is string => id !== undefined)

  const dropFolders = supabase.from('deck_folders').delete().eq('profile_id', userId)
  const { error: dropError } = await (keepIds.length === 0
    ? dropFolders
    : dropFolders.not('id', 'in', `(${keepIds.join(',')})`))
  if (dropError !== null) throw new Error(dropError.message)

  if (names.length === 0) return

  for (const folder of state.folders) {
    const folderId = folderIdByName.get(folder.name)
    if (folderId === undefined) continue

    const wanted = folder.deckSlugs
      .map((slug) => deckIds.get(slug))
      .filter((id): id is string => id !== undefined)

    if (wanted.length > 0) {
      const { error: addError } = await supabase.from('deck_folder_decks').upsert(
        wanted.map((deckId, index) => ({ folder_id: folderId, deck_id: deckId, position: index })),
        { onConflict: 'folder_id,deck_id' },
      )
      if (addError !== null) throw new Error(addError.message)
    }

    const dropDecks = supabase.from('deck_folder_decks').delete().eq('folder_id', folderId)
    const { error: dropDecksError } = await (wanted.length === 0
      ? dropDecks
      : dropDecks.not('deck_id', 'in', `(${wanted.join(',')})`))
    if (dropDecksError !== null) throw new Error(dropDecksError.message)
  }
}
