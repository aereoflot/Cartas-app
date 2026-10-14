import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Match, TallyEntry } from '@/types/cards'
import { loadMatch, saveMatch, tallyTotal, totalsByLabel } from '@/lib/matchStore'
import { useGame } from '@/hooks/useCatalogue'
import { formatElapsed } from '@/lib/format'
import { useTicker } from '@/hooks/useTicker'
import { useOnline } from '@/hooks/useOnline'
import { RulesSections } from '@/components/RulesSections'

type Tool = 'notes' | 'calc' | 'timer' | 'rules' | 'referee'

export function MatchPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [match, setMatch] = useState<Match | null>(() => (id ? loadMatch(id) : null))
  const [tool, setTool] = useState<Tool>('notes')

  const { data: game } = useGame(match?.gameSlug)
  const running = match !== null && match.endedAt === undefined
  useTicker(running)

  const patch = useCallback((partial: Partial<Match>) => {
    setMatch((current) => {
      if (current === null) return current
      const next = { ...current, ...partial }
      saveMatch(next)
      return next
    })
  }, [])

  if (match === null || game === undefined || game === null) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted">404</p>
        <Link to="/" className="mt-3 inline-block text-accent">
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const elapsed = match.endedAt
    ? new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime()
    : Date.now() - new Date(match.startedAt).getTime()

  const end = () => {
    if (window.confirm(t('match.confirmEnd'))) {
      patch({ endedAt: new Date().toISOString() })
    }
  }

  const tools: Array<{ key: Tool; label: string }> = [
    { key: 'notes', label: t('match.notes') },
    { key: 'calc', label: t('match.calc') },
    { key: 'timer', label: t('match.timer') },
    { key: 'rules', label: t('match.rules') },
    { key: 'referee', label: t('match.referee') },
  ]

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      {/* Minimal on purpose: the game and the clock, nothing that pulls the eye
          away from the table. */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-semibold">{game.title}</h1>
          {/* the stake sits under the title: visible all game, never in the way */}
          {match.stake !== undefined && (
            <p className="truncate text-xs text-accent">{match.stake}</p>
          )}
          {match.endedAt !== undefined && (
            <p className="text-xs text-muted">{t('match.ended')}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg tabular-nums" aria-label={t('match.timer')}>
            {formatElapsed(elapsed)}
          </span>
          <Link
            to={`/games/${game.slug}`}
            className="text-muted"
            aria-label={t('common.back')}
          >
            ✕
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tool === 'notes' && <NotesTool match={match} patch={patch} />}
        {tool === 'calc' && <TallyTool match={match} patch={patch} />}
        {tool === 'timer' && <RoundTimer />}
        {tool === 'rules' && (
          <RulesSections sections={game.sections} jumpLabel={t('match.jumpTo')} />
        )}
        {tool === 'referee' && <RefereeTool />}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-2">
        {match.endedAt === undefined && (
          <button
            type="button"
            onClick={end}
            className="mb-2 w-full rounded-full border border-line py-2 text-sm font-medium text-muted"
          >
            {t('match.end')}
          </button>
        )}
        <nav className="safe-bottom grid grid-cols-5 gap-1">
          {tools.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTool(key)}
              aria-current={tool === key}
              className={`rounded-card py-2 text-xs font-semibold ${
                tool === key ? 'bg-accent text-accent-ink' : 'text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

/** Autosaves on every keystroke: nobody presses save mid-game. */
function NotesTool({
  match,
  patch,
}: {
  match: Match
  patch: (p: Partial<Match>) => void
}) {
  const { t } = useTranslation()
  return (
    <textarea
      value={match.notes}
      onChange={(e) => patch({ notes: e.target.value })}
      placeholder={t('match.notesPlaceholder')}
      readOnly={match.endedAt !== undefined}
      className="h-full min-h-64 w-full resize-none rounded-card border border-line bg-surface p-3 font-mono text-base leading-relaxed outline-none focus:border-accent"
    />
  )
}

/**
 * A tape, not a calculator: adding up a round of chinchón is a column of
 * numbers per player, and you want to see what you entered.
 */
function TallyTool({
  match,
  patch,
}: {
  match: Match
  patch: (p: Partial<Match>) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [label, setLabel] = useState(match.playerNames[0] ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const add = (sign: 1 | -1) => {
    const value = Number(draft.replace(',', '.'))
    if (!Number.isFinite(value) || draft.trim() === '') return
    const entry: TallyEntry = {
      id: crypto.randomUUID(),
      label: label === '' ? '—' : label,
      value: sign * value,
    }
    patch({ tally: [...match.tally, entry] })
    setDraft('')
    inputRef.current?.focus()
  }

  const totals = useMemo(() => totalsByLabel(match.tally), [match.tally])

  return (
    <div className="space-y-4">
      {match.playerNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {match.playerNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setLabel(name)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                label === name
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add(1)
          }}
          className="min-w-0 flex-1 rounded-card border border-line bg-surface px-3 py-2.5 font-mono text-lg outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => add(1)}
          className="w-14 rounded-card bg-accent text-xl font-bold text-accent-ink"
          aria-label={`${t('match.add')} +`}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => add(-1)}
          className="w-14 rounded-card border border-line text-xl font-bold"
          aria-label={`${t('match.add')} −`}
        >
          −
        </button>
      </div>

      {totals.length > 0 && (
        <div
          role="group"
          aria-label={t('match.total')}
          className="rounded-card border border-line bg-surface"
        >
          {totals.map(([name, sum]) => (
            <div
              key={name}
              className="flex items-baseline justify-between border-b border-line px-3 py-2 last:border-0"
            >
              <span className="text-sm">{name}</span>
              <span className="font-mono tabular-nums">{sum}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between bg-surface-2 px-3 py-2 font-semibold">
            <span className="text-sm">{t('match.total')}</span>
            <span className="font-mono tabular-nums">{tallyTotal(match.tally)}</span>
          </div>
        </div>
      )}

      {match.tally.length > 0 && (
        <>
          <ul className="space-y-1 font-mono text-sm">
            {[...match.tally].reverse().map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-2">
                <span className="text-muted">{e.label}</span>
                <span className="tabular-nums">{e.value > 0 ? `+${e.value}` : e.value}</span>
                <button
                  type="button"
                  onClick={() => patch({ tally: match.tally.filter((x) => x.id !== e.id) })}
                  className="text-muted"
                  aria-label={t('match.clear')}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => patch({ tally: [] })}
            className="text-xs font-medium text-danger"
          >
            {t('match.clear')}
          </button>
        </>
      )}
    </div>
  )
}

/** A second clock, for a round or a thinking limit. Deliberately not persisted. */
function RoundTimer() {
  const { t } = useTranslation()
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [accumulated, setAccumulated] = useState(0)
  const running = startedAt !== null
  useTicker(running)

  const elapsed = accumulated + (startedAt === null ? 0 : Date.now() - startedAt)

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <p className="font-mono text-6xl tabular-nums">{formatElapsed(elapsed)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (running) {
              setAccumulated(elapsed)
              setStartedAt(null)
            } else {
              setStartedAt(Date.now())
            }
          }}
          className="rounded-full bg-accent px-6 py-2.5 font-semibold text-accent-ink"
        >
          {running ? t('match.pause') : t('match.start_round')}
        </button>
        <button
          type="button"
          onClick={() => {
            setStartedAt(null)
            setAccumulated(0)
          }}
          className="rounded-full border border-line px-6 py-2.5 font-medium"
        >
          {t('match.reset')}
        </button>
      </div>
      <p className="text-xs text-muted">{t('match.round')}</p>
    </div>
  )
}

/** The only tool that needs a connection — and it says so rather than spinning. */
function RefereeTool() {
  const { t } = useTranslation()
  const online = useOnline()

  return (
    <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {online ? t('match.refereeSoon') : t('match.refereeOffline')}
    </p>
  )
}
