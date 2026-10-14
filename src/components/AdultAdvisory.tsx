import { useTranslation } from 'react-i18next'
import { readJson, writeJson } from '@/lib/store'

const ACK_KEY = 'cartas.adultAck'

export const hasAcknowledgedAdult = (): boolean => readJson<boolean>(ACK_KEY, false)

/**
 * Advisory, not an age gate: asking for a birthday proves nothing and costs
 * every user a form (product spec §3.9). Acknowledged once per device.
 */
export function AdultAdvisory({
  onAccept,
  onBack,
}: {
  onAccept: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()

  const accept = () => {
    writeJson(ACK_KEY, true)
    onAccept()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="advisory-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-4"
    >
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-5">
        <h2 id="advisory-title" className="text-lg font-semibold text-warn">
          {t('advisory.title')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed">{t('advisory.body')}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={accept}
            className="flex-1 rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink"
          >
            {t('advisory.accept')}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-line px-4 py-2.5 font-medium"
          >
            {t('advisory.back')}
          </button>
        </div>
      </div>
    </div>
  )
}
