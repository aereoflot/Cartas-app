import { useSyncExternalStore } from 'react'
import {
  deckFolders,
  favoriteDecks,
  favoriteGames,
  friendGroups,
  groupMessages,
  hideAdult,
  ownedDecks,
  subscribe,
  type DeckFolder,
  type FriendGroup,
  type GroupMessage,
} from '@/lib/prefs'

export function useFavoriteGames(): string[] {
  return useSyncExternalStore(subscribe, favoriteGames, favoriteGames)
}

export function useFavoriteDecks(): string[] {
  return useSyncExternalStore(subscribe, favoriteDecks, favoriteDecks)
}

export function useOwnedDecks(): string[] {
  return useSyncExternalStore(subscribe, ownedDecks, ownedDecks)
}

export function useHideAdult(): boolean {
  return useSyncExternalStore(subscribe, hideAdult, hideAdult)
}

export function useDeckFolders(): DeckFolder[] {
  return useSyncExternalStore(subscribe, deckFolders, deckFolders)
}

export function useFriendGroups(): FriendGroup[] {
  return useSyncExternalStore(subscribe, friendGroups, friendGroups)
}

export function useGroupMessages(groupId: string): GroupMessage[] {
  const read = () => groupMessages(groupId)
  return useSyncExternalStore(subscribe, read, read)
}
