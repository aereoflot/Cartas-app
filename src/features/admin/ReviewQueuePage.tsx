import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Game } from '@/types/cards'
import { fetchPendingGames } from '@/lib/catalogue'
import { approveGame, rejectGame, takeDownGame } from '@/lib/review'
import { fetchOpenReports, resolveReport, type OpenReport } from '@/lib/reports'
import { fetchMyProfile } from '@/lib/profile'
import { useLocale } from '@/hooks/useCatalogue'
import { useSession } from '@/hooks/useSession'
import { Loading, LoadFailed } from '@/components/QueryState'
import { SignInRequired } from '@/components/SignInRequired'
import { RequirementStrip } from '@/components/RequirementStrip'
import { RulesSections } from '@/components/RulesSections'
import { Chip } from '@/components/Chip'
import { Link } from 'react-router'
import { SectionTitle } from '@/components/SectionTitle'

/**
 * The owner's queue. Every submitted game waits here, and the point of the
 * screen is that reviewing is a *read*: the game is shown exactly as a reader
 * would see it — the requirements strip and the rules sections, the same
 * components the public page uses — so a decision needs no digging.
 */
export function ReviewQueuePage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { session, pending } = useSession()
  const userId = session?.user.id

  const { data: profile } = useQuery({
    queryKey: ['my-profile', userId],
    queryFn: () => fetchMyProfile(userId as string),
    enabled: userId !== undefined,
  })

  const isReviewer = profile?.role === 'owner' || profile?.role === 'moderator'

  const queue = useQuery({
    queryKey: ['review-queue', locale],
    queryFn: () => fetchPendingGames(locale),
    enabled: isReviewer,
  })

  // Reports land on this same screen on purpose: a submitted game and a
  // reported game are the same job — somebody looking at a game and deciding —
  // and two screens is how one of them stops being opened.
  const reports = useQuery({
    queryKey: ['open-reports'],
    queryFn: fetchOpenReports,
    enabled: isReviewer,
  })

  if (pending) return <Loading />

  if (session === null) {
    return <SignInRequired title={t('review.title')} />
  }

  if (profile !== null && profile !== undefined && !isReviewer) {
    return (
      <div className="px-4 py-10 text-center">
        <h1 className="text-xl font-bold">{t('review.title')}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{t('review.notYours')}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold">{t('review.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('review.intro')}</p>

      <SectionTitle>{t('review.waiting')}</SectionTitle>

      {queue.error !== null ? (
        <LoadFailed error={queue.error} />
      ) : queue.isPending ? (
        <Loading />
      ) : (queue.data ?? []).length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
          {t('review.empty')}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {(queue.data ?? []).map((game) => (
            <li key={game.id}>
              <PendingGame game={game} reviewerId={userId as string} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <SectionTitle>{t('review.reports')}</SectionTitle>
        {(reports.data ?? []).length === 0 ? (
          <p className="mt-1 rounded-card border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
            {t('review.noReports')}
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {(reports.data ?? []).map((report) => (
              <li key={report.id}>
                <ReportedGame report={report} reviewerId={userId as string} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * One report: what was said, about which game, by whom, and the two things
 * that can be done with it.
 *
 * "Resolved" and "dismissed" are both closing it, and the difference is only
 * for whoever reads the table later — so the buttons say what they mean
 * ("arreglado" / "no hay nada que arreglar") rather than the column's words.
 */
function ReportedGame({ report, reviewerId }: { report: OpenReport; reviewerId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState(false)
  const [reason, setReason] = useState('')

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['open-reports'] })
    void queryClient.invalidateQueries({ queryKey: ['games'] })
    void queryClient.invalidateQueries({ queryKey: ['review-queue'] })
  }

  const close = useMutation({
    mutationFn: (status: 'resolved' | 'dismissed') => resolveReport(report.id, status),
    onSuccess: refresh,
  })

  // Taking a game down is the one way back through a door that is otherwise
  // one-way, so it asks for a reason: the author reads it on their profile.
  const takeDown = useMutation({
    mutationFn: async () => {
      await takeDownGame(report.gameId, reviewerId, reason)
      await resolveReport(report.id, 'resolved')
    },
    onSuccess: refresh,
  })

  return (
    <article className="space-y-2 rounded-card border border-warn/40 bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        {report.gameSlug !== null ? (
          <Link to={`/games/${report.gameSlug}`} className="font-semibold">
            {report.gameTitle}
          </Link>
        ) : (
          <span className="font-semibold text-muted">{t('review.reportGameGone')}</span>
        )}
        <Chip tone="warn">{t(`report.reasons.${report.reason}`)}</Chip>
      </div>

      {report.detail !== null && (
        <p className="text-sm leading-relaxed">{report.detail}</p>
      )}
      <p className="text-xs text-muted">
        {report.reporter === null
          ? t('review.reportByGone')
          : t('review.reportBy', { name: report.reporter })}
      </p>

      <div className="flex gap-2 border-t border-line pt-2">
        <button
          type="button"
          disabled={close.isPending}
          onClick={() => close.mutate('resolved')}
          className="flex-1 rounded-full border border-line px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {t('review.reportFixed')}
        </button>
        <button
          type="button"
          disabled={close.isPending}
          onClick={() => close.mutate('dismissed')}
          className="flex-1 rounded-full border border-line px-3 py-2 text-sm font-medium text-muted disabled:opacity-50"
        >
          {t('review.reportNothing')}
        </button>
      </div>

      {report.gameSlug !== null && (
        <button
          type="button"
          onClick={() => setRemoving(!removing)}
          aria-expanded={removing}
          className="w-full text-xs font-medium text-danger"
        >
          {t('review.takeDown')}
        </button>
      )}

      {removing && (
        <div className="space-y-2 border-t border-line pt-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('review.reasonLabel')}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={t('review.takeDownPlaceholder')}
              className="w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <p className="text-xs text-muted">{t('review.takeDownHint')}</p>
          <button
            type="button"
            disabled={reason.trim() === '' || takeDown.isPending}
            onClick={() => takeDown.mutate()}
            className="w-full rounded-full bg-danger px-4 py-2.5 font-semibold text-surface disabled:opacity-50"
          >
            {t('review.confirmTakeDown')}
          </button>
        </div>
      )}

      {(close.error ?? takeDown.error) !== null && (
        <p role="alert" className="text-sm text-danger">
          {t('review.actionFailed')}
        </p>
      )}
    </article>
  )
}

function PendingGame({ game, reviewerId }: { game: Game; reviewerId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ['review-queue'] })
    void queryClient.invalidateQueries({ queryKey: ['games'] })
  }

  const approve = useMutation({
    mutationFn: () => approveGame(game.id, reviewerId),
    onSuccess: done,
  })
  const reject = useMutation({
    mutationFn: () => rejectGame(game.id, reviewerId, reason),
    onSuccess: done,
  })

  const failure = approve.error ?? reject.error

  return (
    <article className="space-y-3 rounded-card border border-line bg-surface p-4">
      <header>
        <h2 className="text-lg font-bold">{game.title}</h2>
        {game.tagline !== undefined && <p className="text-sm text-muted">{game.tagline}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {game.authorName !== undefined && (
            <Chip>{t('game.byAuthor', { name: game.authorName })}</Chip>
          )}
          {game.adultOnly && <Chip tone="danger">{t('game.adult')}</Chip>}
        </div>
      </header>

      <p className="text-sm leading-relaxed">{game.summary}</p>

      {/* the same components the public page uses: review by reading, not digging */}
      <RequirementStrip game={game} />
      <RulesSections sections={game.sections} jumpLabel={t('match.jumpTo')} />

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button
          type="button"
          disabled={approve.isPending}
          onClick={() => approve.mutate()}
          className="flex-1 rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {t('review.approve')}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(!rejecting)}
          aria-expanded={rejecting}
          className="rounded-full border border-line px-4 py-2.5 font-medium text-muted"
        >
          {t('review.reject')}
        </button>
      </div>

      {rejecting && (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('review.reasonLabel')}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('review.reasonPlaceholder')}
              className="w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <p className="text-xs text-muted">{t('review.reasonHint')}</p>
          <button
            type="button"
            disabled={reason.trim() === '' || reject.isPending}
            onClick={() => reject.mutate()}
            className="w-full rounded-full bg-danger px-4 py-2.5 font-semibold text-surface disabled:opacity-50"
          >
            {t('review.confirmReject')}
          </button>
        </div>
      )}

      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          {failure instanceof Error ? failure.message : String(failure)}
        </p>
      )}
    </article>
  )
}
