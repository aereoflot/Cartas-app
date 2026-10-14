import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { listMatches } from '@/lib/matchStore'
import { useGames } from '@/hooks/useCatalogue'
import { formatElapsed, formatSince } from '@/lib/format'

export function MatchHistoryPage() {
  const { t, i18n } = useTranslation()
  const matches = useMemo(() => listMatches(), [])
  const { data: games } = useGames()
  const titleFor = (slug: string) => games?.find((g) => g.slug === slug)?.title ?? slug

  return (
    <div className="px-4 py-4">
      <h1 className="mb-3 text-xl font-bold">{t('match.startTitle')}</h1>
      {matches.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
          {t('common.soonBody')}
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const length =
              m.endedAt === undefined
                ? null
                : new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()
            return (
              <li key={m.id}>
                <Link
                  to={`/matches/${m.id}`}
                  className="flex items-baseline justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
                >
                  <span>
                    <span className="block font-medium">{titleFor(m.gameSlug)}</span>
                    <span className="text-xs text-muted">
                      {m.playerCount} {t('common.players')} ·{' '}
                      {formatSince(m.startedAt, i18n.language)}
                      {m.stake !== undefined && ` · ${m.stake}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm text-muted">
                    {length === null ? '…' : formatElapsed(length)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
