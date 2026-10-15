import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { AiMode, AiProblem, Register } from '@/lib/ai'
import { AiError, askExpert, isExpertEnabled } from '@/lib/ai'
import { useGames } from '@/hooks/useCatalogue'
import { useSession } from '@/hooks/useSession'
import { Markdown } from '@/components/Markdown'
import { FilterChip } from '@/components/FilterChip'
import { Loading } from '@/components/QueryState'
import { SignInRequired } from '@/components/SignInRequired'
import { isSupabaseConfigured } from '@/lib/supabase'

const MODES: AiMode[] = ['explain', 'referee', 'suggest']
const REGISTERS: Register[] = ['quick', 'kid', 'example', 'compare']

/**
 * The expert. Three things it is allowed to do, and the limits are the point:
 * the referee answers only from the rules of the game in front of it, and the
 * suggestions come from games that exist here.
 */
export function AiPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const { session } = useSession()
  const { data: games } = useGames()

  const [mode, setMode] = useState<AiMode>((params.get('mode') as AiMode | null) ?? 'explain')
  const [gameSlug, setGameSlug] = useState(params.get('game') ?? '')
  const [register, setRegister] = useState<Register>('quick')
  const [question, setQuestion] = useState('')
  const [players, setPlayers] = useState<number | null>(null)
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState<AiProblem | null>(null)

  const needsGame = mode === 'explain' || mode === 'referee'
  const ready =
    (!needsGame || gameSlug !== '') && (mode !== 'referee' || question.trim() !== '')

  const ask = async () => {
    setAnswer('')
    setProblem(null)
    setAsking(true)
    try {
      await askExpert(
        {
          mode,
          ...(needsGame ? { gameSlug } : {}),
          ...(mode === 'explain' ? { register } : {}),
          ...(question.trim() !== '' ? { question: question.trim() } : {}),
          ...(players !== null ? { players } : {}),
        },
        (chunk) => setAnswer((current) => current + chunk),
      )
    } catch (error) {
      setProblem(error instanceof AiError ? error.problem : 'unknown')
    } finally {
      setAsking(false)
    }
  }

  // Before anything else, including the sign-in wall: there is nothing behind
  // it to sign in for yet, and asking somebody to make an account to reach a
  // "coming soon" sign is a small insult.
  if (!isExpertEnabled) return <ExpertComingSoon />

  if (!isSupabaseConfigured || session === null) {
    return (
      <SignInRequired title={t('nav.expert')} reason={t('ai.problem.sign-in-required')} />
    )
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <header>
        <h1 className="text-xl font-bold">{t('nav.expert')}</h1>
        <p className="mt-1 text-sm text-muted">{t('ai.intro')}</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {MODES.map((option) => (
          <FilterChip key={option} on={mode === option} onClick={() => setMode(option)}>
            {t(`ai.mode.${option}`)}
          </FilterChip>
        ))}
      </div>
      <p className="text-xs text-muted">{t(`ai.modeHint.${mode}`)}</p>

      {needsGame && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('ai.whichGame')}</span>
          <select
            value={gameSlug}
            onChange={(event) => setGameSlug(event.target.value)}
            className="w-full rounded-card border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
          >
            <option value="">{t('ai.pickGame')}</option>
            {(games ?? []).map((game) => (
              <option key={game.slug} value={game.slug}>
                {game.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === 'explain' && (
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('ai.register')}</p>
          <div className="flex flex-wrap gap-1.5">
            {REGISTERS.map((option) => (
              <FilterChip
                key={option}
                on={register === option}
                onClick={() => setRegister(option)}
              >
                {t(`ai.registerOption.${option}`)}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {mode === 'suggest' && (
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('search.players')}</p>
          <div className="flex flex-wrap gap-1.5">
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <FilterChip
                key={n}
                on={players === n}
                onClick={() => setPlayers(players === n ? null : n)}
              >
                {n}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {mode !== 'explain' && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {mode === 'referee' ? t('ai.situation') : t('ai.anythingElse')}
          </span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder={t(`ai.placeholder.${mode}`)}
            className="w-full rounded-card border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
          />
        </label>
      )}

      <button
        type="button"
        disabled={!ready || asking}
        onClick={() => void ask()}
        className="w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
      >
        {asking ? t('ai.asking') : t('ai.ask')}
      </button>

      {problem !== null && (
        <p role="alert" className="rounded-card border border-danger/40 px-4 py-3 text-sm">
          {t(`ai.problem.${problem}`)}
        </p>
      )}

      {asking && answer === '' && <Loading />}

      {answer !== '' && (
        <section className="rounded-card border border-line bg-surface p-4">
          <Markdown body={answer} />
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{t('ai.caveat')}</p>
        </section>
      )}
    </div>
  )
}

/**
 * What the expert is instead of a form that would always fail.
 *
 * Deliberately specific about what is missing. "Coming soon" with no reason is
 * the kind of notice that stops being believed; saying it is written and
 * waiting on an account with no credit is something somebody can judge for
 * themselves.
 */
function ExpertComingSoon() {
  const { t } = useTranslation()

  return (
    <div className="px-4 py-10">
      <h1 className="text-xl font-bold">{t('nav.expert')}</h1>
      <div className="mt-4 rounded-card border border-dashed border-line bg-surface px-4 py-5">
        <p className="text-base font-semibold text-accent">{t('ai.soonTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('ai.soonBody')}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t('ai.soonMeanwhile')}</p>
      </div>
    </div>
  )
}
