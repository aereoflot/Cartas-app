import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { REPORT_DETAIL_MAX, REPORT_REASONS, reportGame, type ReportReason } from '@/lib/reports'
import { useSession } from '@/hooks/useSession'
import { FlagIcon } from './icons'
import { fieldClass } from './field'

/**
 * Reporting a game: a flag in the corner of its page, and a sheet behind it.
 *
 * In the corner rather than at the bottom because somebody who wants it wants
 * it immediately, and small rather than prominent because the normal thing to
 * do with a game is play it.
 *
 * It asks for a reason from a list and lets the detail be empty. A free-text
 * box alone produces "esto está mal" and nothing to act on; a list alone loses
 * the one thing the reporter knows that the reviewer does not.
 */
export function ReportGame({ gameId, gameTitle }: { gameId: string; gameTitle: string }) {
  const { t } = useTranslation()
  const { session } = useSession()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('wrong-rules')
  const [detail, setDetail] = useState('')

  const send = useMutation({
    mutationFn: () => reportGame(session?.user.id as string, gameId, reason, detail),
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('report.open')}
        title={t('report.open')}
        className="shrink-0 rounded-full border border-line p-2 text-muted"
      >
        <FlagIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/90 p-4 sm:items-center"
        >
          <div className="w-full max-w-sm space-y-3 rounded-card border border-line bg-surface p-5">
            <h2 id="report-title" className="text-lg font-semibold">
              {t('report.title')}
            </h2>
            <p className="text-sm text-muted">{t('report.about', { name: gameTitle })}</p>

            {/* Signed out there is nobody to attribute it to, and the policy
                would refuse the row, so it says so instead of failing. */}
            {session === null ? (
              <p className="rounded-card border border-dashed border-line px-3 py-3 text-sm text-muted">
                {t('report.needsAccount')}
              </p>
            ) : send.isSuccess ? (
              <p className="rounded-card border border-accent/40 bg-accent-soft px-3 py-3 text-sm">
                {t('report.sent')}
              </p>
            ) : (
              <>
                <fieldset className="space-y-1.5">
                  <legend className="mb-1 text-sm font-medium">{t('report.reason')}</legend>
                  {REPORT_REASONS.map((option) => (
                    <label key={option} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="report-reason"
                        value={option}
                        checked={reason === option}
                        onChange={() => setReason(option)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <span>{t(`report.reasons.${option}`)}</span>
                    </label>
                  ))}
                </fieldset>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">{t('report.detail')}</span>
                  <textarea
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                    rows={3}
                    maxLength={REPORT_DETAIL_MAX}
                    placeholder={t('report.detailPlaceholder')}
                    className={fieldClass}
                  />
                </label>

                <button
                  type="button"
                  disabled={send.isPending}
                  onClick={() => send.mutate()}
                  className="w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
                >
                  {send.isPending ? t('report.sending') : t('report.send')}
                </button>

                {send.error !== null && (
                  <p role="alert" className="text-sm text-danger">
                    {t('report.failed')}
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                send.reset()
                setDetail('')
              }}
              className="w-full rounded-full border border-line px-4 py-2.5 font-medium"
            >
              {send.isSuccess ? t('common.close') : t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
