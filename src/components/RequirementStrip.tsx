import { useTranslation } from 'react-i18next'
import type { Game } from '@/types/cards'
import { requirementDeck } from '@/lib/decks'
import { durationRange, playerRange } from '@/lib/format'
import { Chip } from './Chip'

/**
 * The first thing on a game page: everything you need to know before you sit
 * down. Deliberately above the rules.
 */
export function RequirementStrip({ game }: { game: Game }) {
  const { t } = useTranslation()
  const duration = durationRange(game.durationMin, game.durationMax)
  const policyTone = game.missingCardsPolicy === 'strict' ? 'warn' : 'neutral'

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {t('game.needs')}
      </h2>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>
          {playerRange(game.playersMin, game.playersMax)} {t('common.players')}
        </Chip>
        {game.playersBest !== undefined && (
          <Chip tone="accent">{t('game.bestWith', { n: game.playersBest })}</Chip>
        )}
        {game.supportsTeams && <Chip>{t('game.teams')}</Chip>}
        {duration !== null && (
          <Chip>
            {duration} {t('common.minutes')}
          </Chip>
        )}
        {game.complexity !== undefined && (
          <Chip>{t('game.complexity', { n: game.complexity })}</Chip>
        )}
        {game.ageMin !== undefined && <Chip>{t('game.ageMin', { n: game.ageMin })}</Chip>}
        {game.adultOnly && <Chip tone="danger">{t('game.adult')}</Chip>}
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {game.decks.map((req) => {
          const { name, cardCount } = requirementDeck(req)
          return (
            <li key={req.deckSlug} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">
                {req.quantity > 1 ? `${req.quantity}× ` : ''}
                {name}
              </span>
              {cardCount !== undefined && (
                <span className="text-muted">{t('deck.cards', { count: cardCount })}</span>
              )}
              {req.note !== undefined && <span className="text-muted">— {req.note}</span>}
            </li>
          )
        })}
      </ul>

      {game.requiresExtras.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="text-muted">{t('game.extras')}: </span>
          {game.requiresExtras.join(', ')}
        </p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <Chip tone={policyTone}>{t(`game.missing.${game.missingCardsPolicy}`)}</Chip>
        {game.missingCardsNote !== undefined && (
          <p className="mt-2 text-sm text-muted">{game.missingCardsNote}</p>
        )}
      </div>
    </section>
  )
}
