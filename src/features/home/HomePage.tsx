import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SampleBanner } from '@/components/SampleBanner'
import { GameCard } from '@/components/GameCard'
import { GameSearch } from '@/features/search/GameSearch'
import { openMatch } from '@/lib/matchStore'
import { formatSince } from '@/lib/format'
import { useDecks, useGame, useGames } from '@/hooks/useCatalogue'
import { useFavoriteDecks, useFavoriteGames } from '@/hooks/usePrefs'
import { SectionTitle } from '@/components/SectionTitle'

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="px-4 py-3">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </section>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
      {children}
    </p>
  )
}

/**
 * Deliberately short. The searcher is the whole of "play now" — results appear
 * as you type — and the favourites blocks stay empty until you star something,
 * rather than being padded with a preselection nobody asked for.
 */
export function HomePage() {
  const { t, i18n } = useTranslation()
  const { data: games } = useGames()
  const { data: decks } = useDecks()
  const favGames = useFavoriteGames()
  const favDecks = useFavoriteDecks()

  // an unfinished match is the one thing someone reopening the app mid-game wants
  const resumable = useMemo(() => openMatch(), [])
  const { data: resumableGame } = useGame(resumable?.gameSlug)

  const starredGames = (games ?? []).filter((g) => favGames.includes(g.slug))
  const starredDecks = (decks ?? []).filter((d) => favDecks.includes(d.slug))

  return (
    <div className="divide-y divide-line">
      <div className="px-4 pt-4">
        <SampleBanner />
      </div>

      {resumable !== undefined && resumableGame !== undefined && resumableGame !== null && (
        <Section title={t('home.resume')}>
          <Link
            to={`/matches/${resumable.id}`}
            className="flex items-center justify-between gap-3 rounded-card border border-accent/40 bg-accent-soft px-4 py-3"
          >
            <span>
              <span className="block font-semibold">{resumableGame.title}</span>
              <span className="text-xs text-muted">
                {t('home.resumeSince', {
                  time: formatSince(resumable.startedAt, i18n.language),
                })}
                {resumable.stake !== undefined && ` · ${resumable.stake}`}
              </span>
            </span>
            <span className="text-accent" aria-hidden="true">
              →
            </span>
          </Link>
        </Section>
      )}

      <Section title={t('home.playNow')}>
        <GameSearch variant="home" />
      </Section>

      <Section
        title={t('home.favorites')}
        action={
          <Link to="/search" className="text-xs font-medium text-accent">
            {t('search.title')} →
          </Link>
        }
      >
        {starredGames.length === 0 ? (
          <EmptyNote>{t('home.favoritesEmpty')}</EmptyNote>
        ) : (
          <div className="space-y-2">
            {starredGames.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={t('home.favDecks')}
        action={
          <Link to="/decks" className="text-xs font-medium text-accent">
            {t('nav.decks')} →
          </Link>
        }
      >
        {starredDecks.length === 0 ? (
          <EmptyNote>{t('home.favDecksEmpty')}</EmptyNote>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {starredDecks.map((deck) => (
              <Link
                key={deck.slug}
                to={`/decks/${deck.slug}`}
                className="shrink-0 rounded-card border border-line bg-surface px-3 py-2 text-sm"
              >
                {deck.name}
              </Link>
            ))}
          </div>
        )}
      </Section>

    </div>
  )
}
