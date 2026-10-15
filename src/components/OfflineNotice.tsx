import { useTranslation } from 'react-i18next'
import { useOnline } from '@/hooks/useOnline'
import { useSession } from '@/hooks/useSession'

/**
 * A line under the header while there is no signal.
 *
 * The app is local-first, so almost everything keeps working: stars go on,
 * notes get typed, a match is scored to the end. What does not happen is the
 * push to the account, and the only way to find that out used to be noticing
 * later that a favourite had not followed you to another device.
 *
 * Shown only to somebody signed in. With no account there is nothing to sync
 * to, so "changes are not being saved to your account" would be a warning about
 * a thing that was never going to happen.
 *
 * Not dismissible, because it disappears by itself the moment there is signal,
 * and it is one line.
 */
export function OfflineNotice() {
  const { t } = useTranslation()
  const online = useOnline()
  const { session } = useSession()

  if (online || session === null) return null

  return (
    <p
      role="status"
      className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-xs leading-relaxed text-warn"
    >
      {t('sync.offline')}
    </p>
  )
}
