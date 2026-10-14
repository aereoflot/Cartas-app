import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Game } from '@/types/cards'
import { fetchPendingGames } from '@/lib/catalogue'
import { approveGame, rejectGame } from '@/lib/review'
import { fetchMyProfile } from '@/lib/profile'
import { useLocale } from '@/hooks/useCatalogue'
import { useSession } from '@/hooks/useSession'
import { Loading, LoadFailed } from '@/components/QueryState'
import { SignInRequired } from '@/components/SignInRequired'
import { RequirementStrip } from '@/components/RequirementStrip'
import { RulesSections } from '@/components/RulesSections'
import { Chip } from '@/components/Chip'

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
    </div>
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
