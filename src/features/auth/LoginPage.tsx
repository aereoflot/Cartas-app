import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SignInError } from '@/lib/auth'
import {
  PASSWORD_MIN,
  checkPassword,
  isUsernameFree,
  looksLikeEmail,
  signIn,
  signUp,
} from '@/lib/account'
import { checkUsername, normalizeUsername, USERNAME_MAX } from '@/lib/username'
import { isSupabaseConfigured } from '@/lib/supabase'
import { fieldClass } from '@/components/field'

type Mode = 'in' | 'up'
type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; problem: string; detail: string }
type Taken = 'unknown' | 'checking' | 'free' | 'taken'

/**
 * Ordinary registration: a handle, an address, a password.
 *
 * Nothing is emailed and nothing has to be confirmed — signing up signs you in.
 * That is the whole point: a confirmation link opens in whatever browser the
 * mail app prefers, and the session then lives in that browser rather than the
 * one in front of you, which on a phone looks exactly like a broken app.
 */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('in')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [reveal, setReveal] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [taken, setTaken] = useState<Taken>('unknown')

  const handle = normalizeUsername(username)
  const badHandle = checkUsername(username)
  const badPassword = checkPassword(password)
  const emailOk = looksLikeEmail(email)

  // Ask whether the handle is free while they type, not after they have chosen
  // a password. Debounced, and every answer is checked against what is in the
  // box now, so a slow reply cannot label the wrong name.
  useEffect(() => {
    if (mode !== 'up' || badHandle !== null) {
      setTaken('unknown')
      return
    }
    setTaken('checking')
    let live = true
    const timer = window.setTimeout(() => {
      void isUsernameFree(handle)
        .then((free) => {
          if (live) setTaken(free ? 'free' : 'taken')
        })
        .catch(() => {
          if (live) setTaken('unknown')
        })
    }, 400)

    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [handle, badHandle, mode])

  const ready =
    emailOk &&
    (mode === 'in'
      ? password !== ''
      : badHandle === null && badPassword === null && password === again && taken !== 'taken')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ready || status.kind === 'busy') return
    setStatus({ kind: 'busy' })
    try {
      if (mode === 'in') await signIn(email, password)
      else await signUp(handle, email, password)
      void navigate('/me')
    } catch (error) {
      setStatus({
        kind: 'error',
        problem: error instanceof SignInError ? error.problem : 'unknown',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="px-4 py-10">
        <h1 className="text-xl font-bold">{t('auth.title')}</h1>
        <p className="mt-3 rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
          {t('auth.notConfigured')}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-8">
      <h1 className="text-xl font-bold">{mode === 'in' ? t('auth.title') : t('auth.signUpTitle')}</h1>
      <p className="mt-1 text-sm text-muted">
        {mode === 'in' ? t('auth.bodyPassword') : t('auth.signUpBody')}
      </p>

      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-3">
        {mode === 'up' && (
          <div className="block">
            {/* tied by id rather than nesting: the decorative @, and any error
                below, would otherwise end up in the name a screen reader reads */}
            <label htmlFor="login-username" className="mb-1 block text-sm font-medium">
              {t('profile.username')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted" aria-hidden="true">
                @
              </span>
              <input
                id="login-username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  setStatus({ kind: 'idle' })
                }}
                maxLength={USERNAME_MAX}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                className={`${fieldClass} min-w-0 flex-1`}
              />
            </div>
            {username !== '' && badHandle !== null && (
              <span className="mt-1 block text-xs text-danger">
                {t(`profile.${badHandle}`, { min: 3, max: USERNAME_MAX })}
              </span>
            )}
            {badHandle === null && taken !== 'unknown' && (
              <span
                className={`mt-1 block text-xs ${taken === 'taken' ? 'text-danger' : 'text-accent'}`}
              >
                {taken === 'checking'
                  ? t('auth.checking')
                  : taken === 'taken'
                    ? t('auth.handleTaken')
                    : t('auth.handleFree')}
              </span>
            )}
            <span className="mt-1 block text-xs text-muted">{t('auth.handleNote')}</span>
          </div>
        )}

        <div className="block">
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
            {t('auth.email')}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setStatus({ kind: 'idle' })
            }}
            placeholder="tu@correo.com"
            className={fieldClass}
          />
          {email !== '' && !emailOk && (
            <span className="mt-1 block text-xs text-danger">{t('auth.emailShape')}</span>
          )}
        </div>

        <div className="block">
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
            {t('auth.password')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="login-password"
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setStatus({ kind: 'idle' })
              }}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              className={`${fieldClass} min-w-0 flex-1`}
            />
            {/* Showing it beats asking for it twice on a phone keyboard, where
                typing blind is the actual problem. */}
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium text-muted"
            >
              {reveal ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
          {mode === 'up' && password !== '' && badPassword !== null && (
            <span className="mt-1 block text-xs text-danger">
              {t(`auth.password_${badPassword === 'too-short' ? 'short' : 'common'}`, {
                min: PASSWORD_MIN,
              })}
            </span>
          )}
        </div>

        {mode === 'up' && (
          <div className="block">
            <label htmlFor="login-again" className="mb-1 block text-sm font-medium">
              {t('auth.passwordAgain')}
            </label>
            <input
              id="login-again"
              type={reveal ? 'text' : 'password'}
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              autoComplete="new-password"
              className={fieldClass}
            />
            {again !== '' && again !== password && (
              <span className="mt-1 block text-xs text-danger">{t('auth.passwordMismatch')}</span>
            )}
          </div>
        )}

        {mode === 'up' && (
          <p className="rounded-card border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
            {t('auth.noVerification')}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || status.kind === 'busy'}
          className="w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
        >
          {status.kind === 'busy'
            ? t('auth.working')
            : mode === 'in'
              ? t('auth.signIn')
              : t('auth.signUpAction')}
        </button>

        {status.kind === 'error' && (
          <div role="alert" className="rounded-card border border-danger/40 px-3 py-2.5">
            <p className="text-sm text-danger">{t(`auth.problem.${status.problem}`)}</p>
            <p className="mt-1 text-xs text-muted">{status.detail}</p>
          </div>
        )}
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setStatus({ kind: 'idle' })
          setAgain('')
        }}
        className="mt-5 w-full text-center text-sm font-medium text-accent"
      >
        {mode === 'in' ? t('auth.needAccount') : t('auth.haveAccount')}
      </button>

      <p className="mt-6 text-xs text-muted">
        {t('auth.emailNote')}{' '}
        <Link to="/privacidad" className="text-accent">
          {t('auth.privacy')}
        </Link>
      </p>
    </div>
  )
}
