import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { PASSWORD_MIN, checkPassword, setNewPassword } from '@/lib/account'
import { SignInError } from '@/lib/auth'
import { useSession } from '@/hooks/useSession'
import { Loading } from '@/components/QueryState'
import { fieldClass } from '@/components/field'

/**
 * Where the recovery email lands: set a new password and nothing else.
 *
 * No current password is asked for, unlike the profile — somebody recovering an
 * account does not have the old one, and the link out of their mailbox is the
 * proof. The Supabase client picks the recovery token out of the URL by itself,
 * which is why this page only has to wait for a session to appear.
 *
 * If there is no session the link was old, already used, or opened in a
 * different browser from the one it was requested in. All three look identical
 * from here and all three have the same answer, so the page says what to do
 * rather than guessing which one it was.
 */
export function NewPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, pending } = useSession()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [reveal, setReveal] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const weak = checkPassword(password)
  const ready = weak === null && password !== '' && password === again

  const save = useMutation({
    mutationFn: () => setNewPassword(password),
    onSuccess: () => {
      setProblem(null)
      void navigate('/me')
    },
    onError: (error) => setProblem(error instanceof SignInError ? error.problem : 'unknown'),
  })

  if (pending) return <Loading />

  if (session === null) {
    return (
      <div className="px-4 py-10">
        <h1 className="text-xl font-bold">{t('auth.newPasswordTitle')}</h1>
        <p className="mt-3 rounded-card border border-dashed border-line px-3 py-4 text-sm leading-relaxed text-muted">
          {t('auth.newPasswordNoLink')}
        </p>
        <button
          type="button"
          onClick={() => void navigate('/login')}
          className="mt-4 w-full rounded-full border border-line px-4 py-2.5 font-medium"
        >
          {t('auth.backToSignIn')}
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-8">
      <h1 className="text-xl font-bold">{t('auth.newPasswordTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('auth.newPasswordBody')}</p>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (ready && !save.isPending) save.mutate()
        }}
        className="mt-5 space-y-3"
      >
        <div className="block">
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium">
            {t('profile.newPassword')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-password"
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium text-muted"
            >
              {reveal ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
          {password !== '' && weak !== null && (
            <span className="mt-1 block text-xs text-danger">
              {t(`auth.password_${weak === 'too-short' ? 'short' : 'common'}`, {
                min: PASSWORD_MIN,
              })}
            </span>
          )}
        </div>

        <div className="block">
          <label htmlFor="new-password-again" className="mb-1 block text-sm font-medium">
            {t('auth.passwordAgain')}
          </label>
          <input
            id="new-password-again"
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

        <button
          type="submit"
          disabled={!ready || save.isPending}
          className="w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
        >
          {save.isPending ? t('auth.working') : t('auth.newPasswordAction')}
        </button>

        {problem !== null && (
          <p role="alert" className="rounded-card border border-danger/40 px-3 py-2.5 text-sm text-danger">
            {t(`auth.problem.${problem}`)}
          </p>
        )}
      </form>
    </div>
  )
}
