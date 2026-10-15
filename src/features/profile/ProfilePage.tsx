import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useSyncState } from '@/hooks/useSync'
import type { SyncState } from '@/lib/sync'
import { fetchMyProfile, fetchMySettings, updateMyProfile } from '@/lib/profile'
import { listMyGames } from '@/lib/gameWrite'
import { deleteMyAccount, signOut } from '@/lib/auth'
import { changePassword, checkPassword, isUsernameFree, PASSWORD_MIN } from '@/lib/account'
import { checkUsername, normalizeUsername, USERNAME_MAX } from '@/lib/username'
import { SignInError } from '@/lib/auth'
import { Loading } from '@/components/QueryState'
import { Chip } from '@/components/Chip'
import { Collapsible } from '@/components/Collapsible'
import { SignInRequired } from '@/components/SignInRequired'
import { InstallSection } from '@/components/InstallSection'
import { canInstallAtAll } from '@/lib/install'
import { fieldClass } from '@/components/field'

/**
 * Everything about your account, in drawers.
 *
 * It used to be one column: name, handle, a content preference, a password
 * form, the install card, your games, two links and a delete button, all open
 * at once. Six screens of scrolling to change a password, and the state of a
 * game somebody had sent for review was somewhere in the middle of it.
 *
 * Now each thing is a drawer that says what it holds, and the two that cannot
 * wait — a sync that failed, and the way out — stay in the open.
 */
export function ProfilePage() {
  const { t } = useTranslation()
  const { session, pending } = useSession()
  const userId = session?.user.id
  const sync = useSyncState()

  const { data: profile } = useQuery({
    queryKey: ['my-profile', userId],
    queryFn: () => fetchMyProfile(userId as string),
    enabled: userId !== undefined,
  })

  const myGames = useQuery({
    queryKey: ['my-games', userId],
    queryFn: () => listMyGames(userId as string),
    enabled: userId !== undefined,
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

  const isReviewer = profile?.role === 'owner' || profile?.role === 'moderator'
  const installable = (() => {
    try {
      return canInstallAtAll()
    } catch {
      return false
    }
  })()
  const waiting = (myGames.data ?? []).filter((game) => game.status === 'pending_review').length

  return (
    <div className="space-y-5 px-4 py-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {profile?.displayName ?? session.user.email}
        </h1>
        {profile !== null && profile !== undefined && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>@{profile.username}</Chip>
            {isReviewer && <Chip tone="accent">{t(`auth.role.${profile.role}`)}</Chip>}
          </div>
        )}
      </header>

      <SyncWarning sync={sync} />

      {isReviewer && (
        <Link
          to="/admin/review"
          className="block rounded-card border border-accent/40 bg-accent-soft px-4 py-3 font-medium"
        >
          {t('auth.reviewQueue')} →
        </Link>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-surface px-4">
        <Collapsible title={t('profile.accountSection')} summary={session.user.email ?? ''}>
          <AccountSection
            userId={userId as string}
            email={session.user.email}
            username={profile?.username}
            displayName={profile?.displayName}
          />
        </Collapsible>

        <Collapsible
          title={t('profile.myGames')}
          summary={waiting > 0 ? t('profile.waitingCount', { count: waiting }) : ''}
        >
          <MyGames games={myGames.data ?? []} loading={myGames.isPending} />
        </Collapsible>

        <Collapsible title={t('profile.playSection')}>
          <nav className="space-y-2">
            <Link
              to="/matches"
              className="block rounded-card border border-line px-4 py-3 text-sm"
            >
              {t('match.history')}
            </Link>
            <Link
              to="/friends"
              className="block rounded-card border border-line px-4 py-3 text-sm"
            >
              {t('nav.friends')}
            </Link>
          </nav>
        </Collapsible>

        {/* InstallSection renders nothing where installing is impossible or
            already done, and a drawer that opens onto nothing is worse than no
            drawer, so the same question is asked before offering it. */}
        {installable && (
          <Collapsible title={t('profile.appSection')}>
            <InstallSection bare />
          </Collapsible>
        )}

        <Collapsible title={t('profile.dataSection')}>
          <DangerSection />
        </Collapsible>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full rounded-full border border-line px-4 py-2.5 font-medium text-muted"
      >
        {t('auth.signOut')}
      </button>
    </div>
  )
}

/**
 * A push that did not go up, said out loud.
 *
 * It has to be visible without opening anything — somebody believing their
 * collection is safe when it is not is worse than no sync at all — and it has
 * to say which half failed, because the old wording blamed favourites for a
 * problem with a match and sent me looking in the wrong place.
 *
 * The server's own words go behind a fold, and the whole thing closes: nothing
 * here is lost, it is on the device and it goes up at the next change, so a
 * banner nobody can dismiss is a scare rather than information. Closing it is
 * remembered against that exact wording, so a different failure speaks again.
 */
function SyncWarning({ sync }: { sync: SyncState }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState<string | null>(null)

  if (sync.status !== 'error' || sync.failed === null) return null
  if (dismissed === sync.error) return null

  return (
    <div role="alert" className="rounded-card border border-warn/50 bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-warn">{t(`sync.failedWhat.${sync.failed}`)}</p>
        <button
          type="button"
          onClick={() => setDismissed(sync.error)}
          aria-label={t('common.close')}
          className="-mt-1 shrink-0 px-1 text-lg leading-none text-muted"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t('sync.failedBody')}</p>
      {sync.error !== null && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs text-muted">
            {t('editor.technicalDetail')}
          </summary>
          <p className="mt-1 break-words text-xs text-muted">{sync.error}</p>
        </details>
      )}
    </div>
  )
}

/**
 * Who you are and how you get in: the name people see, the handle they find
 * you by, and the password.
 *
 * The handle is editable now. It was fixed, with a note saying it was the only
 * door you had — which stopped being true when accounts got an email address to
 * sign in with. A handle somebody cannot change is a name they are stuck with
 * because of a sentence that no longer applies.
 */
function AccountSection({
  userId,
  email,
  username,
  displayName,
}: {
  userId: string
  email: string | undefined
  username: string | undefined
  displayName: string | undefined
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const settings = useQuery({
    queryKey: ['my-settings', userId],
    queryFn: () => fetchMySettings(userId),
  })
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved' | 'taken' | 'invalid'>('idle')
  const [free, setFree] = useState<'unknown' | 'checking' | 'free' | 'taken'>('unknown')

  // fill the boxes once the profile arrives, and only then
  useEffect(() => {
    if (displayName !== undefined) setName(displayName)
  }, [displayName])
  useEffect(() => {
    if (username !== undefined) setHandle(username)
  }, [username])

  const wanted = normalizeUsername(handle)
  const badHandle = checkUsername(handle)
  const handleChanged = username !== undefined && wanted !== username
  const nameChanged = displayName !== undefined && name.trim() !== displayName

  // Ask whether the new handle is free while they type: finding out after
  // pressing save means retyping a name you have already chosen.
  useEffect(() => {
    if (!handleChanged || badHandle !== null) {
      setFree('unknown')
      return
    }
    setFree('checking')
    let live = true
    const timer = window.setTimeout(() => {
      void isUsernameFree(wanted)
        .then((isFree) => {
          if (live) setFree(isFree ? 'free' : 'taken')
        })
        .catch(() => {
          if (live) setFree('unknown')
        })
    }, 400)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [wanted, badHandle, handleChanged])

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile(userId, {
        ...(nameChanged ? { displayName: name.trim() } : {}),
        ...(handleChanged ? { username: wanted } : {}),
      }),
    onSuccess: (result) => {
      setStatus(result)
      if (result === 'saved') {
        void queryClient.invalidateQueries({ queryKey: ['my-profile', userId] })
      }
    },
  })

  const canSave =
    (nameChanged || handleChanged) &&
    (!handleChanged || (badHandle === null && free !== 'taken')) &&
    name.trim() !== ''

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('profile.displayName')}</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setStatus('idle')
          }}
          maxLength={60}
          className={fieldClass}
        />
      </label>

      <div className="block">
        <label htmlFor="profile-username" className="mb-1 block text-sm font-medium">
          {t('profile.username')}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted" aria-hidden="true">
            @
          </span>
          <input
            id="profile-username"
            value={handle}
            onChange={(event) => {
              setHandle(event.target.value)
              setStatus('idle')
            }}
            maxLength={USERNAME_MAX}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${fieldClass} min-w-0 flex-1`}
          />
        </div>
        {handle !== '' && badHandle !== null && (
          <span className="mt-1 block text-xs text-danger">
            {t(`profile.${badHandle}`, { min: 3, max: USERNAME_MAX })}
          </span>
        )}
        {handleChanged && badHandle === null && free !== 'unknown' && (
          <span
            className={`mt-1 block text-xs ${free === 'taken' ? 'text-danger' : 'text-accent'}`}
          >
            {free === 'checking'
              ? t('auth.checking')
              : free === 'taken'
                ? t('auth.handleTaken')
                : t('auth.handleFree')}
          </span>
        )}
        <span className="mt-1 block text-xs text-muted">
          {t('profile.usernameHint', { min: 3, max: USERNAME_MAX })}
        </span>
      </div>

      <button
        type="button"
        disabled={!canSave || save.isPending}
        onClick={() => save.mutate()}
        className="w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
      >
        {save.isPending ? t('profile.saving') : t('profile.save')}
      </button>

      {status === 'saved' && <p className="text-sm text-accent">{t('profile.saved')}</p>}
      {status === 'taken' && <p className="text-sm text-danger">{t('profile.taken')}</p>}
      {status === 'invalid' && <p className="text-sm text-danger">{t('profile.invalid')}</p>}

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium">{t('auth.email')}</p>
        <p className="mt-1 text-sm text-muted">{email}</p>
        <p className="mt-1 text-xs text-muted">{t('profile.emailNote')}</p>
      </div>

      {/* Shown, not editable, and only when there is one. It explains why adult
          games are or are not there, which is the only thing it decides. The
          checkbox it replaced is gone on purpose: a preference anybody can
          untick is not an age. */}
      {settings.data?.birthdate != null && (
        <div className="border-t border-line pt-4">
          <p className="text-sm font-medium">{t('auth.birthdate')}</p>
          <p className="mt-1 text-sm text-muted">
            {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
              new Date(`${settings.data.birthdate}T00:00:00`),
            )}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t('profile.birthdateNote')}</p>
        </div>
      )}

      <PasswordFields email={email} />
    </div>
  )
}

/**
 * Changing a password, current one first. Supabase would take the new one on
 * the session alone; asking for the old one means a borrowed phone cannot be
 * turned into a permanent takeover in two taps.
 */
function PasswordFields({ email }: { email: string | undefined }) {
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
    <div className="space-y-3 border-t border-line pt-4">
      <p className="text-sm font-medium">{t('profile.passwordTitle')}</p>

      <div className="block">
        <label htmlFor="pw-current" className="mb-1 block text-xs font-medium text-muted">
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
        <label htmlFor="pw-new" className="mb-1 block text-xs font-medium text-muted">
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
        <label htmlFor="pw-again" className="mb-1 block text-xs font-medium text-muted">
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
        className="w-full rounded-full border border-line px-4 py-2.5 font-medium disabled:opacity-50"
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
    </div>
  )
}

/**
 * Where a game of yours stands, in a sentence.
 *
 * A chip saying "en revisión" tells somebody the word but not what it means for
 * them — whether the game is lost for now, whether they can still play it,
 * whether they are supposed to do something. The sentence answers that, and a
 * rejection carries the reason, because a no nobody can read is the same as
 * silence.
 */
function MyGames({
  games,
  loading,
}: {
  games: Array<{ id: string; slug: string; status: string; title: string; reason: string | null }>
  loading: boolean
}) {
  const { t } = useTranslation()

  if (loading) return <Loading />

  if (games.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
          {t('profile.noGames')}
        </p>
        <Link
          to="/games/new"
          className="block rounded-full bg-accent px-4 py-2.5 text-center font-semibold text-accent-ink"
        >
          {t('profile.newGame')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {games.map((game) => (
          <li key={game.id} className="rounded-card border border-line px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                to={game.status === 'published' ? `/games/${game.slug}` : `/games/${game.slug}/edit`}
                className="font-medium"
              >
                {game.title}
              </Link>
              <Chip
                tone={
                  game.status === 'rejected'
                    ? 'danger'
                    : game.status === 'published'
                      ? 'accent'
                      : 'neutral'
                }
              >
                {t(`profile.gameStatus.${game.status}`)}
              </Chip>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t(`profile.gameStatusNote.${game.status}`)}
            </p>
            {game.reason !== null && (
              <p className="mt-1.5 rounded-card border border-danger/40 px-3 py-2 text-sm text-danger">
                {game.reason}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Link to="/games/new" className="block text-sm font-medium text-accent">
        {t('profile.newGame')} →
      </Link>
    </div>
  )
}

/**
 * Deleting an account has to be as easy as making one, and it has to say
 * beforehand what survives: the games somebody published are rules other people
 * are using.
 */
function DangerSection() {
  const { t } = useTranslation()
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

  return (
    <div className="space-y-2">
      <Link to="/privacidad" className="block text-sm font-medium text-accent">
        {t('auth.privacy')} →
      </Link>
      <p className="text-xs leading-relaxed text-muted">{t('auth.deleteKeeps')}</p>
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
    </div>
  )
}
