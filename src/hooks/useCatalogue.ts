import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Deck, Game, Locale } from '@/types/cards'
import {
  fetchDeck,
  fetchDecks,
  fetchGame,
  fetchGames,
  fetchMyUnpublishedGames,
  type MyGame,
} from '@/lib/catalogue'

/** The reader's language, narrowed to what the content supports. */
export function useLocale(): Locale {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('en') ? 'en' : 'es'
}

export function useGames(): UseQueryResult<Game[]> {
  const locale = useLocale()
  return useQuery({
    queryKey: ['games', locale],
    queryFn: () => fetchGames(locale),
  })
}

export function useGame(slug: string | undefined): UseQueryResult<Game | null> {
  const locale = useLocale()
  return useQuery({
    queryKey: ['game', slug, locale],
    queryFn: () => fetchGame(slug as string, locale),
    enabled: slug !== undefined,
  })
}

/** Drafts and submissions of your own, so a game in the queue is still yours. */
export function useMyUnpublishedGames(
  authorId: string | undefined,
): UseQueryResult<MyGame[]> {
  const locale = useLocale()
  return useQuery({
    queryKey: ['my-unpublished-games', authorId, locale],
    queryFn: () => fetchMyUnpublishedGames(locale, authorId as string),
    enabled: authorId !== undefined,
  })
}

export function useDecks(): UseQueryResult<Deck[]> {
  return useQuery({ queryKey: ['decks'], queryFn: fetchDecks })
}

export function useDeck(slug: string | undefined): UseQueryResult<Deck | null> {
  return useQuery({
    queryKey: ['deck', slug],
    queryFn: () => fetchDeck(slug as string),
    enabled: slug !== undefined,
  })
}
