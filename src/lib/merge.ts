import type { DeckFolder } from './prefs'

/**
 * What to do when someone who has been using the app without an account signs
 * in and already has favourites and folders on both sides.
 *
 * The rule is **union**: nothing a person collected is thrown away by signing
 * in, on either side. Folders are matched by name, because that is what the
 * database makes unique per person, and a folder in both places ends up holding
 * the decks from both.
 *
 * The known limit, stated rather than hidden: a favourite *removed* while signed
 * out comes back when it is still on the server, because a union cannot tell
 * "deleted here" from "never seen here". Fixing that needs tombstones, and it is
 * not worth them for a list of starred decks — once signed in, every change goes
 * straight up, so deletes made from then on stick.
 *
 * Kept pure and away from the network so it can be tested on its own.
 */

export interface CollectionState {
  favoriteGames: string[]
  favoriteDecks: string[]
  folders: DeckFolder[]
  /** the decks this person actually owns, which is what "can we play it" needs */
  ownedDecks: string[]
  /** keep 18+ games out of search and lists */
  hideAdult: boolean
}

export interface MergePlan {
  /** what both sides should hold afterwards */
  merged: CollectionState
  /** favourites the server does not have yet */
  gamesToUpload: string[]
  decksToUpload: string[]
  ownedToUpload: string[]
  /** folders the server does not have yet, by name */
  foldersToCreate: Array<{ name: string; deckSlugs: string[] }>
  /** decks to add to folders the server already has */
  folderDecksToAdd: Array<{ name: string; deckSlugs: string[] }>
}

const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])]

export function planMerge(local: CollectionState, remote: CollectionState): MergePlan {
  const remoteGames = new Set(remote.favoriteGames)
  const remoteDecks = new Set(remote.favoriteDecks)
  const remoteOwned = new Set(remote.ownedDecks)

  const remoteFolderByName = new Map(remote.folders.map((f) => [f.name, f]))

  const mergedFolders: DeckFolder[] = remote.folders.map((folder) => {
    const localTwin = local.folders.find((f) => f.name === folder.name)
    return localTwin === undefined
      ? folder
      : { ...folder, deckSlugs: union(folder.deckSlugs, localTwin.deckSlugs) }
  })

  const foldersToCreate: MergePlan['foldersToCreate'] = []
  for (const folder of local.folders) {
    if (remoteFolderByName.has(folder.name)) continue
    mergedFolders.push(folder)
    foldersToCreate.push({ name: folder.name, deckSlugs: folder.deckSlugs })
  }

  const folderDecksToAdd: MergePlan['folderDecksToAdd'] = []
  for (const folder of local.folders) {
    const twin = remoteFolderByName.get(folder.name)
    if (twin === undefined) continue
    const missing = folder.deckSlugs.filter((slug) => !twin.deckSlugs.includes(slug))
    if (missing.length > 0) folderDecksToAdd.push({ name: folder.name, deckSlugs: missing })
  }

  return {
    merged: {
      favoriteGames: union(remote.favoriteGames, local.favoriteGames),
      favoriteDecks: union(remote.favoriteDecks, local.favoriteDecks),
      folders: mergedFolders,
      ownedDecks: union(remote.ownedDecks, local.ownedDecks),
      // a content preference is not a collection: if either side asked to hide
      // 18+ games, honour it rather than quietly turning it back off
      hideAdult: local.hideAdult || remote.hideAdult,
    },
    gamesToUpload: local.favoriteGames.filter((slug) => !remoteGames.has(slug)),
    decksToUpload: local.favoriteDecks.filter((slug) => !remoteDecks.has(slug)),
    ownedToUpload: local.ownedDecks.filter((slug) => !remoteOwned.has(slug)),
    foldersToCreate,
    folderDecksToAdd,
  }
}
