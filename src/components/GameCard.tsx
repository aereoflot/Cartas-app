import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Game } from '@/types/cards'
import { requirementDeck } from '@/lib/decks'
import { durationRange, playerRange } from '@/lib/format'
import { toggleFavoriteGame } from '@/lib/prefs'
import { useFavoriteGames } from '@/hooks/usePrefs'
import { Chip } from './Chip'
import { FavoriteStar } from './FavoriteStar'
import { StarIcon } from './icons'

/**
 * `status` is set only for an author looking at their own unpublished game, so
 * a draft in a list of published games cannot be mistaken for one.
 */
export function GameCard({ game, status }: { game: Game; status?: string }) {
  const { t } = useTranslation()
  const favorites = useFavoriteGames()
  const duration = durationRange(game.durationMin, game.durationMax)

  return (
    <div className="relative">
      <FavoriteStar
        on={favorites.includes(game.slug)}
        onToggle={() => toggleFavoriteGame(game.slug)}
        label={t('favorites.toggleGame', { name: game.title })}
      />
      <Link
        to={`/games/${game.slug}`}
        className="block rounded-card border border-line bg-surface p-4 pr-12 transition-colors hover:border-accent/40"
      >
        <div className="flex items-baseline gap-2">
          <h3 className="truncate font-semibold">{game.title}</h3>
          {status !== undefined && (
            <Chip tone={status === 'rejected' ? 'danger' : 'accent'}>
              {t(`profile.gameStatus.${status}`)}
            </Chip>
          )}
        </div>
        {game.tagline !== undefined && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{game.tagline}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>
            {playerRange(game.playersMin, game.playersMax)} {t('common.players')}
          </Chip>
          {duration !== null && (
            <Chip>
              {duration} {t('common.minutes')}
            </Chip>
          )}
          {game.decks.map((req) => (
            <Chip key={req.deckSlug} tone="accent">
              {req.quantity > 1 ? `${req.quantity}× ` : ''}
              {requirementDeck(req).name}
            </Chip>
          ))}
          {game.adultOnly && <Chip tone="danger">{t('game.adult')}</Chip>}
          {game.ratingCount > 0 && (
            <Chip>
              <StarIcon filled className="h-3.5 w-3.5 text-suit-gold" />
              {game.ratingAvg.toFixed(1)}
            </Chip>
          )}
        </div>
      </Link>
    </div>
  )
}
