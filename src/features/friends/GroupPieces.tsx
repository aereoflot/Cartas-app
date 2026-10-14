import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { matchesWithGroup } from '@/lib/matchStore'
import { formatSince } from '@/lib/format'
import { useGames } from '@/hooks/useCatalogue'

/**
 * The two halves a group card shows, whether the group lives on this device or
 * on the account: what you have played together, and what you have said.
 *
 * They were written twice, once per kind of group, and were identical both
 * times — the only real difference between the two cards is where the data comes
 * from, which is the caller's business.
 */

export function GroupMatches({
  groupId,
  memberNames,
}: {
  groupId: string
  memberNames: string[]
}) {
  const { t, i18n } = useTranslation()
  const { data: games } = useGames()

  const matches = useMemo(
    () => matchesWithGroup(groupId, memberNames).slice(0, 4),
    // the names are compared by value: a new array of the same names is not a change
    [groupId, memberNames.join('\u0000')],
  )

  return (
    <>
      <h4 className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">
        {t('groups.lastMatches')}
      </h4>
      {matches.length === 0 ? (
        <p className="mt-1 text-xs text-muted">{t('groups.noMatches')}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {matches.map((match) => (
            <li key={match.id} className="text-sm">
              <Link to={`/matches/${match.id}`} className="text-accent">
                {games?.find((game) => game.slug === match.gameSlug)?.title ?? match.gameSlug}
              </Link>
              <span className="text-muted">
                {' · '}
                {formatSince(match.startedAt, i18n.language)}
                {match.stake !== undefined && ` · ${match.stake}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export interface ChatLine {
  id: string
  who: string
  body: string
  at: string
}

export function GroupChat({
  lines,
  note,
  busy = false,
  onSend,
}: {
  lines: ChatLine[]
  /** said under the heading: for a local group, that it reaches nobody yet */
  note?: string
  busy?: boolean
  onSend: (body: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState('')

  const send = () => {
    const body = draft.trim()
    if (body === '') return
    onSend(body)
    setDraft('')
  }

  return (
    <>
      <h4 className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">
        {t('groups.chat')}
      </h4>
      {note !== undefined && <p className="text-xs text-muted">{note}</p>}

      {lines.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {lines.map((line) => (
            <li key={line.id} className="rounded-card bg-surface-2 px-3 py-2 text-sm">
              <span className="font-medium">{line.who}</span>
              <span className="ml-2 text-xs text-muted">
                {formatSince(line.at, i18n.language)}
              </span>
              <p className="mt-0.5">{line.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send()
          }}
          placeholder={t('groups.chatPlaceholder')}
          aria-label={t('groups.message')}
          className="min-w-0 flex-1 rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={draft.trim() === '' || busy}
          onClick={send}
          className="shrink-0 rounded-card border border-line px-4 py-2 font-medium disabled:opacity-50"
        >
          {t('groups.send')}
        </button>
      </div>
    </>
  )
}
