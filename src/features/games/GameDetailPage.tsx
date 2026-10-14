import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { RequirementStrip } from '@/components/RequirementStrip'
import { RulesSections } from '@/components/RulesSections'
import { AdultAdvisory, hasAcknowledgedAdult } from '@/components/AdultAdvisory'
import { Loading, LoadFailed } from '@/components/QueryState'
import { useGame } from '@/hooks/useCatalogue'
import { SectionTitle } from '@/components/SectionTitle'

export function GameDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: game, isPending, error } = useGame(slug)
  const [acknowledged, setAcknowledged] = useState(hasAcknowledgedAdult)

  if (isPending) return <Loading />
  if (error !== null) return <LoadFailed error={error} />

  if (game === null || game === undefined) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-muted">404</p>
        <Link to="/search" className="mt-3 inline-block text-accent">
          {t('search.title')}
        </Link>
      </div>
    )
  }

  // the advisory shows once per device, before the rules of any 18+ game
  if (game.adultOnly && !acknowledged) {
    return (
      <AdultAdvisory
        onAccept={() => setAcknowledged(true)}
        onBack={() => void navigate(-1)}
      />
    )
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{game.title}</h1>
        {game.tagline !== undefined && <p className="mt-1 text-muted">{game.tagline}</p>}
        {game.authorName !== undefined && (
          <p className="mt-1 text-xs text-muted">
            {t('game.byAuthor', { name: game.authorName })}
          </p>
        )}
      </header>

      <p className="text-[0.95rem] leading-relaxed">{game.summary}</p>

      <RequirementStrip game={game} />

      <Link
        to={`/games/${game.slug}/play`}
        className="block rounded-full bg-accent px-4 py-3 text-center text-lg font-semibold text-accent-ink"
      >
        {t('game.play')}
      </Link>

      <div className="flex gap-2">
        <Link
          to="/ai"
          className="flex-1 rounded-full border border-line bg-surface px-3 py-2 text-center text-sm font-medium"
        >
          {t('game.explain')}
        </Link>
        <Link
          to="/ai"
          className="flex-1 rounded-full border border-line bg-surface px-3 py-2 text-center text-sm font-medium"
        >
          {t('game.ask')}
        </Link>
      </div>

      <section>
        <SectionTitle>{t('game.rules')}</SectionTitle>
        <RulesSections sections={game.sections} jumpLabel={t('match.jumpTo')} />
      </section>
    </div>
  )
}
