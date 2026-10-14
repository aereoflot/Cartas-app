import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSyncState } from '@/hooks/useSync'
import { useHideAdult } from '@/hooks/usePrefs'
import { setHideAdult } from '@/lib/prefs'
import { fetchMyProfile, updateMyProfile } from '@/lib/profile'
import { listMyGames } from '@/lib/gameWrite'
import { deleteMyAccount, signOut } from '@/lib/auth'
import { changePassword, checkPassword, PASSWORD_MIN } from '@/lib/account'
import { SignInError } from '@/lib/auth'
import { Loading } from '@/components/QueryState'
import { Chip } from '@/components/Chip'
import { SectionTitle } from '@/components/SectionTitle'
import { SignInRequired } from '@/components/SignInRequired'
import { InstallSection } from '@/components/InstallSection'
import { fieldClass } from '@/components/field'

export function ProfilePage() {
  const { t } = useTranslation()
  const { session, pending } = useSession()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['my-profile', userId],
    queryFn: () => fetchMyProfile(userId as string),
    enabled: userId !== undefined,
  })

  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved' | 'taken' | 'invalid'>('idle')
  const sync = useSyncState()
  const hideAdult = useHideAdult()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const removeAccount = async () => {
    if (!window.confirm(t('auth.deleteConfirm'))) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMyAccount()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }

  const myGames = useQuery({
    queryKey: ['my-games', userId],
    queryFn: () => listMyGames(userId as string),
    enabled: userId !== undefined,
  })

  // fill the form once the profile arrives, and only then
  useEffect(() => {
    if (profile !== null && profile !== undefined) setDisplayName(profile.displayName)
  }, [profile])

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile(userId as string, { displayName: displayName.trim() }),
    onSuccess: (result) => {
      setStatus(result === 'saved' ? 'saved' : result)
      if (result === 'saved') {
        void queryClient.invalidateQueries({ queryKey: ['my-profile', userId] })
      }
    },
  })

  if (pending) return <Loading />

  if (session === null) {
    return (
      <>
        <SignInRequired title={t('nav.profile')} />
        <div className="px-4 pb-8">
          <InstallSection />
        </div>
      </>
    )
  }

  const changed =
    profile !== null && profile !== undefined && displayName.trim() !== profile.displayName
  const isReviewer = profile?.role === 'owner' || profile?.role === 'moderator'

  return (
    <div className="space-y-6 px-4 py-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {profile?.displayName ?? session.user.email}
        </h1>
        <p className="mt-1 text-sm text-muted">{session.user.email}</p>
        {profile !== null && profile !== undefined && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>@{profile.username}</Chip>
            {isReviewer && <Chip tone="accent">{t(`auth.role.${profile.role}`)}</Chip>}
          </div>
        )}
      </header>

      {/* The handle is how friends find you, so it is editable and explained
          rather than derived from your email address and left alone. */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4">
        <h2 className="font-semibold">{t('profile.edit')}</h2>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('profile.displayName')}</span>
          <input
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
              setStatus('idle')
            }}
            maxLength={60}
            className={fieldClass}
          />
        </label>

        {/* The handle is what you sign in with, so it is shown rather than
            edited: renaming it would move the only door you have, and with no
            email there is no second way through. */}
        <div>
          <span className="mb-1 block text-sm font-medium">{t('profile.username')}</span>
          <p className="rounded-card border border-line bg-surface-2 px-3 py-2.5 text-base">
            @{profile?.username ?? '…'}
          </p>
          <span className="mt-1 block text-xs text-muted">{t('profile.usernameFixed')}</span>
        </div>

        <button
          type="button"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate()}
          className="w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {save.isPending ? t('profile.saving') : t('profile.save')}
        </button>

        {status === 'saved' && <p className="text-sm text-accent">{t('profile.saved')}</p>}
        {status === 'taken' && <p className="text-sm text-danger">{t('profile.taken')}</p>}
        {status === 'invalid' && <p className="text-sm text-danger">{t('profile.invalid')}</p>}
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="font-semibold">{t('profile.settings')}</h2>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideAdult}
            onChange={(event) => setHideAdult(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            {t('profile.hideAdult')}
            <span className="mt-0.5 block text-xs text-muted">{t('profile.hideAdultHint')}</span>
          </span>
        </label>
      </section>

      <PasswordSection email={session.user.email} />

      <InstallSection />

      {/* Favourites and folders are kept on the device first and pushed to the
          account after; if that push fails, say so instead of letting someone
          believe their collection is safe. */}
      {sync.status === 'error' && (
        <p role="alert" className="rounded-card border border-danger/40 px-4 py-3 text-sm">
          <span className="font-semibold text-danger">{t('sync.failed')}</span>{' '}
          <span className="text-muted">{sync.error}</span>
        </p>
      )}

      {isReviewer && (
        <Link
          to="/admin/review"
          className="block rounded-card border border-accent/40 bg-accent-soft px-4 py-3 font-medium"
        >
          {t('auth.reviewQueue')} →
        </Link>
      )}

      {/* An author has to be able to see why a game was turned down; a rejection
          nobody can read is the same as silence. */}
      <section>
        <SectionTitle
          action={
            <Link to="/games/new" className="text-xs font-medium text-accent">
              {t('profile.newGame')} →
            </Link>
          }
        >
          {t('profile.myGames')}
        </SectionTitle>
        {(myGames.data ?? []).length === 0 ? (
          <p className="rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
            {t('profile.noGames')}
          </p>
        ) : (
          <ul className="space-y-2">
            {(myGames.data ?? []).map((game) => (
              <li key={game.id} className="rounded-card border border-line bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    to={game.status === 'published' ? `/games/${game.slug}` : `/games/${game.slug}/edit`}
                    className="font-medium"
                  >
                    {game.title}
                  </Link>
                  <Chip tone={game.status === 'rejected' ? 'danger' : 'neutral'}>
                    {t(`profile.gameStatus.${game.status}`)}
                  </Chip>
                </div>
                {game.reason !== null && (
                  <p className="mt-1 text-sm text-danger">{game.reason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="space-y-2">
        <Link to="/matches" className="block rounded-card border border-line bg-surface px-4 py-3">
          {t('match.history')}
        </Link>
        <Link to="/friends" className="block rounded-card border border-line bg-surface px-4 py-3">
          {t('nav.friends')}
        </Link>
      </nav>

      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full rounded-full border border-line px-4 py-2.5 font-medium text-muted"
      >
        {t('auth.signOut')}
      </button>

      {/* Deleting an account has to be as easy as making one, and it has to say
          beforehand what survives: the games somebody published are rules other
          people are using. */}
      <section className="space-y-2 border-t border-line pt-5">
        <Link to="/privacidad" className="text-sm font-medium text-accent">
          {t('auth.privacy')} →
        </Link>
        <p className="text-xs text-muted">{t('auth.deleteKeeps')}</p>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removeAccount()}
          className="w-full rounded-full border border-danger/40 px-4 py-2.5 font-medium text-danger disabled:opacity-50"
        >
          {deleting ? t('auth.deleting') : t('auth.deleteAccount')}
        </button>
        {deleteError !== null && (
          <p role="alert" className="text-sm text-danger">
            {deleteError}
          </p>
        )}
      </section>
    </div>
  )
}

/**
 * Changing a password, current one first. Supabase would take the new one on
 * the session alone; asking for the old one means a borrowed phone cannot be
 * turned into a permanent takeover, which matters more here than usual because
 * there is no email to recover a stolen account with.
 */
function PasswordSection({ email }: { email: string | undefined }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const weak = checkPassword(next)
  const ready =
    email !== undefined && current !== '' && weak === null && next !== '' && next === again

  const change = useMutation({
    mutationFn: () => changePassword(email as string, current, next),
    onSuccess: () => {
      setProblem(null)
      setCurrent('')
      setNext('')
      setAgain('')
    },
    onError: (error) =>
      setProblem(error instanceof SignInError ? error.problem : 'unknown'),
  })

  if (email === undefined) return null

  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <h2 className="font-semibold">{t('profile.passwordTitle')}</h2>

      <div className="block">
        <label htmlFor="pw-current" className="mb-1 block text-sm font-medium">
          {t('profile.currentPassword')}
        </label>
        <input
          id="pw-current"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          className={fieldClass}
        />
      </div>

      <div className="block">
        <label htmlFor="pw-new" className="mb-1 block text-sm font-medium">
          {t('profile.newPassword')}
        </label>
        <input
          id="pw-new"
          type="password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          className={fieldClass}
        />
        {next !== '' && weak !== null && (
          <span className="mt-1 block text-xs text-danger">
            {t(`auth.password_${weak === 'too-short' ? 'short' : 'common'}`, { min: PASSWORD_MIN })}
          </span>
        )}
      </div>

      <div className="block">
        <label htmlFor="pw-again" className="mb-1 block text-sm font-medium">
          {t('auth.passwordAgain')}
        </label>
        <input
          id="pw-again"
          type="password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          autoComplete="new-password"
          className={fieldClass}
        />
        {again !== '' && again !== next && (
          <span className="mt-1 block text-xs text-danger">{t('auth.passwordMismatch')}</span>
        )}
      </div>

      <button
        type="button"
        disabled={!ready || change.isPending}
        onClick={() => change.mutate()}
        className="w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
      >
        {change.isPending ? t('profile.saving') : t('profile.changePassword')}
      </button>

      {change.isSuccess && problem === null && (
        <p className="text-sm text-accent">{t('profile.passwordChanged')}</p>
      )}
      {problem !== null && (
        <p role="alert" className="text-sm text-danger">
          {t(`auth.problem.${problem}`)}
        </p>
      )}
    </section>
  )
}
