import type { CollectionState } from './merge'
import { writeJson } from './store'

/**
 * Per-device preferences: favourites, deck folders and friend groups.
 *
 * All of it lives in local storage for now. The database already has the tables
 * for favourites (`game_favorites`, `deck_favorites`); folders, groups and group
 * messages need accounts before they can follow someone across devices, so this
 * is the honest half: it works today, on this phone, with no sign-in.
 *
 * Reads and writes go through a tiny store with subscribers so a star tapped in
 * one place updates every other place at once, without a round trip.
 */

export interface DeckFolder {
  id: string
  name: string
  deckSlugs: string[]
}

export interface FriendGroup {
  id: string
  name: string
  members: string[]
}

export interface GroupMessage {
  id: string
  author: string
  body: string
  at: string
}

const KEYS = {
  favGames: 'cartas.favGames',
  favDecks: 'cartas.favDecks',
  folders: 'cartas.deckFolders',
  owned: 'cartas.ownedDecks',
  hideAdult: 'cartas.hideAdult',
  groups: 'cartas.friendGroups',
  chat: (groupId: string) => `cartas.groupChat.${groupId}`,
} as const

const listeners = new Set<() => void>()

// stable empty values: a fresh [] each time would also restart the render loop
const EMPTY_STRINGS: string[] = []
const EMPTY_FOLDERS: DeckFolder[] = []
const EMPTY_GROUPS: FriendGroup[] = []
const EMPTY_MESSAGES: GroupMessage[] = []

function announce(): void {
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/* ---------------------------------------------------------------- favourites */

/**
 * useSyncExternalStore compares snapshots by identity, so parsing local storage
 * on every render would hand back a new array each time and spin forever. Cache
 * the parsed value, keyed on the raw string: identical raw means the same object
 * back, a changed (or cleared) raw means a fresh parse. That also keeps this
 * correct when storage is wiped from outside, which plain caching did not.
 */
const snapshots = new Map<string, { raw: string | null; value: unknown }>()

function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    raw = null
  }

  const cached = snapshots.get(key)
  if (cached !== undefined && cached.raw === raw) return cached.value as T

  let value = fallback
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = fallback
    }
  }
  snapshots.set(key, { raw, value })
  return value
}

function persist(key: string, value: unknown): void {
  writeJson(key, value)
  snapshots.set(key, { raw: JSON.stringify(value), value })
  announce()
}

export function favoriteGames(): string[] {
  return snapshot<string[]>(KEYS.favGames, EMPTY_STRINGS)
}

export function favoriteDecks(): string[] {
  return snapshot<string[]>(KEYS.favDecks, EMPTY_STRINGS)
}

/** The decks this person owns. What "only games I can play" is answered from. */
export function ownedDecks(): string[] {
  return snapshot<string[]>(KEYS.owned, EMPTY_STRINGS)
}

export function hideAdult(): boolean {
  return snapshot<boolean>(KEYS.hideAdult, false)
}

export function toggleOwnedDeck(slug: string): void {
  persist(KEYS.owned, toggle(ownedDecks(), slug))
}

export function setHideAdult(value: boolean): void {
  persist(KEYS.hideAdult, value)
}

function toggle(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list]
}

export function toggleFavoriteGame(slug: string): void {
  persist(KEYS.favGames, toggle(favoriteGames(), slug))
}

export function toggleFavoriteDeck(slug: string): void {
  persist(KEYS.favDecks, toggle(favoriteDecks(), slug))
}

/** Favourites first, keeping the order within each half. */
export function favouritesFirst<T>(items: T[], slugOf: (item: T) => string, favs: string[]): T[] {
  const starred = items.filter((item) => favs.includes(slugOf(item)))
  const rest = items.filter((item) => !favs.includes(slugOf(item)))
  return [...starred, ...rest]
}

/* -------------------------------------------------------------- deck folders */

export function deckFolders(): DeckFolder[] {
  return snapshot<DeckFolder[]>(KEYS.folders, EMPTY_FOLDERS)
}

function saveFolders(next: DeckFolder[]): void {
  persist(KEYS.folders, next)
}

export function createDeckFolder(name: string): DeckFolder {
  const folder: DeckFolder = { id: crypto.randomUUID(), name, deckSlugs: [] }
  saveFolders([...deckFolders(), folder])
  return folder
}

export function deleteDeckFolder(id: string): void {
  saveFolders(deckFolders().filter((f) => f.id !== id))
}

export function toggleDeckInFolder(folderId: string, deckSlug: string): void {
  saveFolders(
    deckFolders().map((folder) =>
      folder.id === folderId
        ? {
            ...folder,
            deckSlugs: folder.deckSlugs.includes(deckSlug)
              ? folder.deckSlugs.filter((s) => s !== deckSlug)
              : [...folder.deckSlugs, deckSlug],
          }
        : folder,
    ),
  )
}

/* ------------------------------------------------------------- friend groups */

export function friendGroups(): FriendGroup[] {
  return snapshot<FriendGroup[]>(KEYS.groups, EMPTY_GROUPS)
}

function saveGroups(next: FriendGroup[]): void {
  persist(KEYS.groups, next)
}

export function createFriendGroup(name: string, members: string[]): FriendGroup {
  const group: FriendGroup = { id: crypto.randomUUID(), name, members }
  saveGroups([...friendGroups(), group])
  return group
}

export function deleteFriendGroup(id: string): void {
  saveGroups(friendGroups().filter((g) => g.id !== id))
}

/* ------------------------------------------------------------- group messages */

export function groupMessages(groupId: string): GroupMessage[] {
  return snapshot<GroupMessage[]>(KEYS.chat(groupId), EMPTY_MESSAGES)
}

export function postGroupMessage(groupId: string, author: string, body: string): void {
  persist(KEYS.chat(groupId), [
    ...groupMessages(groupId),
    { id: crypto.randomUUID(), author, body, at: new Date().toISOString() },
  ])
}

/* ------------------------------------------------------- bulk read and write */

/** Everything the account can hold, for the sync engine to compare and send. */
export function readCollections(): CollectionState {
  return {
    favoriteGames: favoriteGames(),
    favoriteDecks: favoriteDecks(),
    folders: deckFolders(),
    ownedDecks: ownedDecks(),
    hideAdult: hideAdult(),
  }
}

/**
 * Replace the lot in one go, announcing once. Used when the server's copy wins:
 * on sign-in, and after a merge.
 */
export function applyCollections(state: CollectionState): void {
  for (const [key, value] of [
    [KEYS.favGames, state.favoriteGames],
    [KEYS.favDecks, state.favoriteDecks],
    [KEYS.folders, state.folders],
    [KEYS.owned, state.ownedDecks],
    [KEYS.hideAdult, state.hideAdult],
  ] as const) {
    writeJson(key, value)
    snapshots.set(key, { raw: JSON.stringify(value), value })
  }
  announce()
}
