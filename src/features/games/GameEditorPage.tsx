import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import type { MissingCardsPolicy } from '@/types/cards'
import type { DraftProblem, GameDraft, Intent } from '@/lib/gameDraft'
import {
  ageChoices,
  draftProblems,
  emptyDraft,
  EXTRA_SECTIONS,
  LIMITS,
  MAIN_SECTION,
} from '@/lib/gameDraft'
import { SaveError } from '@/lib/saveError'
import { createGame, draftFromGame, updateGame } from '@/lib/gameWrite'
import { useDecks, useGame } from '@/hooks/useCatalogue'
import { useSession } from '@/hooks/useSession'
import { Loading, LoadFailed } from '@/components/QueryState'
import { Collapsible } from '@/components/Collapsible'
import { FilterChip } from '@/components/FilterChip'
import { SignInRequired } from '@/components/SignInRequired'
import { fieldClass } from '@/components/field'

/**
 * Writing a game, in five questions.
 *
 * It used to be seven steps and some twenty fields, and people abandoned it
 * halfway — which is the same as it not working. What is left is the name, the
 * sentence that goes under it, how it is played, what you need on the table,
 * and anything else worth saying. Nothing asked twice, nothing asked that the
 * app does not use.
 *
 * The first step is still the only one that changes the rest: private or
 * public. Private asks for the two things the database cannot store a game
 * without; public asks for what a stranger needs in order to play.
 *
 * Nothing here can publish: an author saves privately or submits for review,
 * and the database refuses any other status from a client.
 */
export function GameEditorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const { session, pending } = useSession()
  const editing = slug !== undefined
  // arriving from the searcher with a name nobody had: start from that name
  const wantedTitle = params.get('title') ?? ''

  const existing = useGame(editing ? slug : undefined)
  const [draft, setDraft] = useState<GameDraft | null>(null)

  if (pending || (editing && existing.isPending)) return <Loading />
  if (existing.error !== null) return <LoadFailed error={existing.error} />

  if (session === null) {
    return <SignInRequired title={t('editor.title')} reason={t('editor.needsAccount')} />
  }

  const loaded =
    draft ??
    (editing && existing.data !== null && existing.data !== undefined
      ? draftFromGame(existing.data)
      : { ...emptyDraft(), title: wantedTitle.slice(0, 120) })

  const wasPublished = editing && existing.data?.slug === slug

  return (
    <EditorForm
      draft={loaded}
      onChange={setDraft}
      authorId={session.user.id}
      gameId={existing.data?.id}
      warnRepublish={wasPublished}
      onSaved={(savedSlug) => void navigate(`/games/${savedSlug}`)}
    />
  )
}

/** Which step owns which complaint, so each one can report its own state. */
const STEP_PROBLEMS: Record<string, DraftProblem[]> = {
  name: ['title'],
  brief: ['summary', 'tagline'],
  description: ['sections'],
  needs: [
    'players',
    'playersBest',
    'teamSize',
    'decks',
    'deckQuantity',
    'duration',
    'age',
    'complexity',
  ],
  notes: [],
  send: ['originalWording'],
}

function EditorForm({
  draft,
  onChange,
  authorId,
  gameId,
  warnRepublish,
  onSaved,
}: {
  draft: GameDraft
  onChange: (next: GameDraft) => void
  authorId: string
  gameId: string | undefined
  warnRepublish: boolean
  onSaved: (slug: string) => void
}) {
  const { t } = useTranslation()
  const { data: decks } = useDecks()

  // Public until told otherwise would quietly demand every field of somebody
  // who only wanted a note to themselves, so nothing is assumed: the first step
  // asks, and until it is answered the rest stay shut.
  const [intent, setIntent] = useState<Intent | null>(null)
  const [open, setOpen] = useState<string>('visibility')

  const set = <K extends keyof GameDraft>(key: K, value: GameDraft[K]) =>
    onChange({ ...draft, [key]: value })

  // Two lists, because the two buttons answer to different rules: saving
  // privately needs only what the database demands, submitting needs the rest.
  const privateBlocking = draftProblems(draft, 'private')
  const publicBlocking = draftProblems(draft, 'public')
  const blocking = intent === 'private' ? privateBlocking : publicBlocking

  const sectionBody = (heading: string) =>
    draft.sections.find((section) => section.heading === heading)?.body.trim() ?? ''

  const setSection = (heading: string, body: string) => {
    const index = draft.sections.findIndex((section) => section.heading === heading)
    const next = [...draft.sections]
    if (index === -1) next.push({ heading, body })
    else next[index] = { heading, body }
    set('sections', next)
  }

  /** What stands in the way of *this* step, so each one explains itself. */
  const stepProblems = (step: string): DraftProblem[] =>
    (STEP_PROBLEMS[step] ?? []).filter((problem) => blocking.includes(problem))

  /**
   * Three honest answers and no fourth. A step with something blocking it says
   * so; a step with nothing required and nothing written is optional rather
   * than finished, because calling an empty box "complete" is a small lie that
   * costs somebody a rejected submission later.
   */
  const stepState = (step: string, filled: boolean): 'done' | 'missing' | 'optional' => {
    if (stepProblems(step).length > 0) return 'missing'
    return filled ? 'done' : 'optional'
  }

  const chooseIntent = (next: Intent) => {
    setIntent(next)
    setOpen('name')
  }

  /**
   * A refusal in words. Field problems reuse the form's own wording — the
   * person is being told the same thing either way — and the rest get their own.
   */
  const saveMessage = (error: unknown): string => {
    if (!(error instanceof SaveError)) return t('editor.saveFailed.unknown')
    const standalone = ['slugTaken', 'notAllowed', 'signedOut', 'offline', 'unknown']
    return standalone.includes(error.problem)
      ? t(`editor.saveFailed.${error.problem}`)
      : t(`editor.problem.${error.problem}`)
  }

  const save = useMutation({
    mutationFn: async (status: 'draft' | 'pending_review') => {
      if (gameId !== undefined) {
        await updateGame(gameId, draft, status)
        return null
      }
      return createGame(authorId, draft, status)
    },
    onSuccess: (saved) => {
      if (saved !== null) onSaved(saved.slug)
    },
  })

  const chosenDecks = draft.decks.filter((deck) => deck.deckSlug !== '')
  const deckName = (deckSlug: string) =>
    (decks ?? []).find((deck) => deck.slug === deckSlug)?.name ?? deckSlug

  return (
    <div className="space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-bold">
          {gameId === undefined ? t('editor.title') : t('editor.editing')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('editor.intro')}</p>
      </header>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <Step
          n={1}
          name="visibility"
          title={t('editor.stepVisibility')}
          state={intent === null ? 'missing' : 'done'}
          summary={intent === null ? '' : t(`editor.${intent}Option`)}
          problems={[]}
          open={open}
          onOpen={setOpen}
        >
          <div className="space-y-2">
            {(['private', 'public'] as Intent[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseIntent(option)}
                aria-pressed={intent === option}
                className={`block w-full rounded-card border px-4 py-3 text-left ${
                  intent === option ? 'border-accent bg-accent-soft' : 'border-line'
                }`}
              >
                <span className="block font-semibold">{t(`editor.${option}Option`)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {t(`editor.${option}OptionBody`)}
                </span>
              </button>
            ))}
          </div>
        </Step>

        <Step
          n={2}
          name="name"
          title={t('editor.stepName')}
          state={stepState('name', draft.title.trim() !== '')}
          summary={draft.title.trim()}
          problems={stepProblems('name')}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('brief')}
        >
          <Field label={t('editor.gameTitle')} hint={t('editor.gameTitleHint')}>
            <input
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              maxLength={LIMITS.title.max}
              className={fieldClass}
            />
          </Field>
        </Step>

        <Step
          n={3}
          name="brief"
          title={t('editor.stepBrief')}
          state={stepState('brief', draft.summary.trim() !== '')}
          summary={draft.summary.trim()}
          problems={stepProblems('brief')}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('description')}
        >
          <Field label={t('editor.summary')} hint={t('editor.summaryHint')}>
            <textarea
              value={draft.summary}
              onChange={(event) => set('summary', event.target.value)}
              rows={3}
              maxLength={LIMITS.summary.max}
              className={fieldClass}
            />
          </Field>
          <Counter length={draft.summary.trim().length} min={LIMITS.summary.min} />
        </Step>

        <Step
          n={4}
          name="description"
          title={t('editor.stepDescription')}
          state={stepState('description', sectionBody(MAIN_SECTION) !== '')}
          summary={sectionBody(MAIN_SECTION)}
          problems={stepProblems('description')}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('needs')}
        >
          <Field label={t('editor.howToPlay')} hint={t('editor.howToPlayHint')}>
            <textarea
              value={draft.sections.find((s) => s.heading === MAIN_SECTION)?.body ?? ''}
              onChange={(event) => setSection(MAIN_SECTION, event.target.value)}
              rows={8}
              className={fieldClass}
            />
          </Field>

          {/* Everything a thorough author might want, folded away, so the
              casual one never has to scroll past it. */}
          <div className="rounded-card border border-line px-3">
            <Collapsible
              title={t('editor.extraSections')}
              summary={
                EXTRA_SECTIONS.filter((heading) => sectionBody(heading) !== '').length === 0
                  ? ''
                  : String(EXTRA_SECTIONS.filter((heading) => sectionBody(heading) !== '').length)
              }
            >
              <p className="mb-2 text-xs text-muted">{t('editor.extraSectionsHint')}</p>
              <div className="space-y-2">
                {EXTRA_SECTIONS.map((heading) => (
                  <Field key={heading} label={heading}>
                    <textarea
                      value={draft.sections.find((s) => s.heading === heading)?.body ?? ''}
                      onChange={(event) => setSection(heading, event.target.value)}
                      rows={3}
                      aria-label={heading}
                      className={fieldClass}
                    />
                  </Field>
                ))}
              </div>
            </Collapsible>
          </div>
        </Step>

        <Step
          n={5}
          name="needs"
          title={t('editor.stepNeeds')}
          state={stepState('needs', chosenDecks.length > 0)}
          summary={
            chosenDecks.length === 0
              ? ''
              : `${draft.playersMin}–${draft.playersMax} · ${deckName(chosenDecks[0]!.deckSlug)}`
          }
          problems={stepProblems('needs')}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('notes')}
        >
          <p className="text-xs text-muted">{t('editor.needsHint')}</p>

          <Field label={t('editor.players')}>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label={t('editor.playersMin')}
                value={draft.playersMin}
                min={LIMITS.players.min}
                max={LIMITS.players.max}
                onChange={(value) => set('playersMin', value ?? 1)}
              />
              <NumberField
                label={t('editor.playersMax')}
                value={draft.playersMax}
                min={LIMITS.players.min}
                max={LIMITS.players.max}
                onChange={(value) => set('playersMax', value ?? 1)}
              />
              <NumberField
                label={t('editor.playersBest')}
                value={draft.playersBest}
                min={LIMITS.players.min}
                max={LIMITS.players.max}
                onChange={(value) => set('playersBest', value)}
              />
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.supportsTeams}
              onChange={(event) => set('supportsTeams', event.target.checked)}
              className="h-4 w-4"
            />
            {t('editor.teams')}
          </label>
          {draft.supportsTeams && (
            <NumberField
              label={t('editor.teamSize')}
              value={draft.teamSize}
              min={LIMITS.team.min}
              max={LIMITS.team.max}
              onChange={(value) => set('teamSize', value)}
            />
          )}

          <Field label={t('editor.decks')} hint={t('editor.decksHint')}>
            <div className="space-y-2">
              {draft.decks.map((requirement, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={requirement.deckSlug}
                    onChange={(event) => {
                      const next = [...draft.decks]
                      next[index] = { ...requirement, deckSlug: event.target.value }
                      set('decks', next)
                    }}
                    aria-label={t('editor.deck')}
                    className={`${fieldClass} min-w-0 flex-1`}
                  >
                    <option value="">{t('editor.pickDeck')}</option>
                    {(decks ?? []).map((deck) => (
                      <option key={deck.slug} value={deck.slug}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={LIMITS.deckQuantity.min}
                    max={LIMITS.deckQuantity.max}
                    value={requirement.quantity}
                    onChange={(event) => {
                      const next = [...draft.decks]
                      next[index] = { ...requirement, quantity: Number(event.target.value) || 1 }
                      set('decks', next)
                    }}
                    aria-label={t('editor.howMany')}
                    className={`${fieldClass} w-16 shrink-0`}
                  />
                  {draft.decks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => set('decks', draft.decks.filter((_, i) => i !== index))}
                      aria-label={t('editor.removeDeck')}
                      className="shrink-0 px-2 text-danger"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  set('decks', [...draft.decks, { deckSlug: '', quantity: 1, note: '' }])
                }
                className="text-sm font-medium text-accent"
              >
                {t('editor.addDeck')}
              </button>
            </div>
          </Field>

          <Field label={t('editor.duration')} hint={t('editor.durationHint')}>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label={t('editor.durationMin')}
                value={draft.durationMin}
                min={LIMITS.duration.min}
                max={LIMITS.duration.max}
                onChange={(value) => set('durationMin', value)}
              />
              <NumberField
                label={t('editor.durationMax')}
                value={draft.durationMax}
                min={LIMITS.duration.min}
                max={LIMITS.duration.max}
                onChange={(value) => set('durationMax', value)}
              />
            </div>
          </Field>

          <Field label={t('editor.complexity')} hint={t('editor.complexityHint')}>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <FilterChip
                  key={level}
                  on={draft.complexity === level}
                  onClick={() => set('complexity', draft.complexity === level ? null : level)}
                >
                  {level}
                </FilterChip>
              ))}
            </div>
          </Field>

          <Field label={t('editor.ageMin')} hint={t('editor.ageHint')}>
            <div className="flex flex-wrap gap-1.5">
              {ageChoices(draft.ageMin).map((age) => (
                <FilterChip
                  key={age ?? 'any'}
                  on={draft.ageMin === age}
                  onClick={() => set('ageMin', age)}
                >
                  {age === null ? t('editor.ageAny') : `${age}+`}
                </FilterChip>
              ))}
            </div>
          </Field>

          <Field label={t('editor.extras')} hint={t('editor.listHint')}>
            <input
              value={draft.requiresExtras.join(', ')}
              onChange={(event) => set('requiresExtras', splitList(event.target.value))}
              className={fieldClass}
            />
          </Field>

          <Field label={t('game.missing.label')} hint={t('editor.missingHint')}>
            <div className="flex flex-wrap gap-1.5">
              {(['strict', 'tolerant', 'irrelevant'] as MissingCardsPolicy[]).map((policy) => (
                <FilterChip
                  key={policy}
                  on={draft.missingCardsPolicy === policy}
                  onClick={() => set('missingCardsPolicy', policy)}
                >
                  {t(`game.missing.${policy}`)}
                </FilterChip>
              ))}
            </div>
            <textarea
              value={draft.missingCardsNote}
              onChange={(event) => set('missingCardsNote', event.target.value)}
              rows={2}
              placeholder={t('editor.missingNotePlaceholder')}
              className={`${fieldClass} mt-2`}
            />
          </Field>
        </Step>

        <Step
          n={6}
          name="notes"
          title={t('editor.stepNotes')}
          state={stepState('notes', sectionBody('Notas') !== '')}
          summary={sectionBody('Notas')}
          problems={[]}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('send')}
        >
          <Field label={t('editor.notes')} hint={t('editor.notesHint')}>
            <textarea
              value={draft.sections.find((s) => s.heading === 'Notas')?.body ?? ''}
              onChange={(event) => setSection('Notas', event.target.value)}
              rows={4}
              className={fieldClass}
            />
          </Field>
        </Step>

        <Step
          n={7}
          name="send"
          title={intent === 'private' ? t('editor.stepSave') : t('editor.stepSend')}
          state={stepState('send', intent !== 'public' || draft.originalWording)}
          summary=""
          // this step lists everything that is blocking, below, so the per-step
          // box would say the same thing twice on the same screen
          problems={[]}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
        >
          <div className="space-y-3">
            {/* The attestations are the price of publishing, so they are asked
                only of somebody who is publishing. */}
            {intent === 'public' && (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.originalWording}
                    onChange={(event) => set('originalWording', event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{t('editor.originalWording')}</span>
                </label>
                <p className="text-xs text-muted">{t('editor.copyrightNote')}</p>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.adultOnly}
                    onChange={(event) => set('adultOnly', event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{t('editor.adultOnly')}</span>
                </label>
              </>
            )}

            {warnRepublish && (
              <p className="rounded-card border border-warn/40 px-4 py-3 text-sm text-warn">
                {t('editor.republishWarning')}
              </p>
            )}

            <p className="text-xs leading-relaxed text-muted">
              {intent === 'private' ? t('editor.privateNote') : t('editor.publicNote')}
            </p>

            {blocking.length > 0 && (
              <ul className="space-y-1 rounded-card border border-dashed border-line px-4 py-3 text-sm text-muted">
                {blocking.map((problem: DraftProblem) => (
                  <li key={problem}>· {t(`editor.problem.${problem}`)}</li>
                ))}
              </ul>
            )}

            {intent === 'public' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={privateBlocking.length > 0 || save.isPending}
                  onClick={() => save.mutate('draft')}
                  className="flex-1 rounded-full border border-line px-4 py-3 font-medium disabled:opacity-50"
                >
                  {t('editor.saveDraft')}
                </button>
                <button
                  type="button"
                  disabled={publicBlocking.length > 0 || save.isPending}
                  onClick={() => save.mutate('pending_review')}
                  className="flex-1 rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
                >
                  {save.isPending ? t('editor.saving') : t('editor.submit')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={privateBlocking.length > 0 || save.isPending}
                onClick={() => save.mutate('draft')}
                className="w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
              >
                {save.isPending ? t('editor.saving') : t('editor.savePrivate')}
              </button>
            )}

            {save.isSuccess && <p className="text-sm text-accent">{t('editor.saved')}</p>}
            {save.error !== null && (
              <div role="alert" className="rounded-card border border-danger/40 px-4 py-3">
                <p className="text-sm font-medium text-danger">{saveMessage(save.error)}</p>
                {/* the database's own words, folded away: useless to almost
                    everybody, and the only thing worth having when it is
                    something nobody anticipated */}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted">
                    {t('editor.technicalDetail')}
                  </summary>
                  <p className="mt-1 break-words text-xs text-muted">
                    {save.error instanceof Error ? save.error.message : String(save.error)}
                  </p>
                </details>
              </div>
            )}
          </div>
        </Step>
      </div>

      <p className="px-1 text-xs leading-relaxed text-muted">{t('editor.twoWays')}</p>
    </div>
  )
}

/**
 * One step of the form: a row you tap to open, with its number and how it
 * stands. Only one is open at a time, so a long form reads as a short list of
 * decisions rather than a page that never ends — and the state on the right
 * means you can see what is left without opening anything.
 *
 * The state is spelled out — complete, missing something, optional — because a
 * coloured tick is only legible to somebody who already knows the convention.
 * When something is missing, the step says which thing, in the same words the
 * save button would use.
 *
 * `locked` holds the later steps shut until the first one is answered, because
 * what those steps require depends on that answer.
 */
function Step({
  n,
  name,
  title,
  state,
  summary,
  problems,
  open,
  onOpen,
  locked = false,
  onNext,
  children,
}: {
  n: number
  name: string
  title: string
  state: 'done' | 'missing' | 'optional'
  summary: string
  problems: DraftProblem[]
  open: string
  onOpen: (name: string) => void
  locked?: boolean
  onNext?: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const isOpen = open === name && !locked

  const mark = state === 'done' ? '✓' : state === 'optional' ? '·' : '!'
  const markTone =
    state === 'done'
      ? 'bg-accent text-accent-ink'
      : state === 'optional'
        ? 'bg-surface-2 text-muted'
        : 'bg-warn/15 text-warn'
  const stateTone = state === 'missing' ? 'text-warn' : 'text-muted'

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => onOpen(isOpen ? '' : name)}
        aria-expanded={isOpen}
        disabled={locked}
        className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-40"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${markTone}`}
          aria-hidden="true"
        >
          {isOpen ? n : mark}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {!isOpen && summary !== '' && (
            <span className="block truncate text-xs text-muted">{summary}</span>
          )}
        </span>
        <span className={`shrink-0 text-xs ${stateTone}`}>{t(`editor.state.${state}`)}</span>
        <span className="shrink-0 text-muted" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-3 px-4 pb-4">
          {problems.length > 0 && (
            <ul className="space-y-1 rounded-card border border-dashed border-warn/50 px-3 py-2 text-xs text-warn">
              {problems.map((problem) => (
                <li key={problem}>· {t(`editor.problem.${problem}`)}</li>
              ))}
            </ul>
          )}
          {children}
          {onNext !== undefined && (
            <button
              type="button"
              onClick={onNext}
              className="w-full rounded-full border border-accent px-4 py-2.5 text-sm font-semibold text-accent"
            >
              {t('editor.next')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const splitList = (raw: string): string[] =>
  raw.split(',').map((item) => item.trim()).filter((item) => item !== '')

/** How much is written, when there is a minimum worth counting towards. */
function Counter({ length, min }: { length: number; min: number }) {
  const { t } = useTranslation()
  if (length >= min) return null
  return (
    <p className="text-xs text-muted">{t('editor.charactersLeft', { n: min - length })}</p>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint !== undefined && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number | null
  min: number
  max: number
  onChange: (value: number | null) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
        onBlur={() => {
          // Clamping as you type fights the typist ("1" on the way to "12");
          // clamping on the way out just quietly keeps it legal.
          if (value === null) return
          const settled = Math.min(max, Math.max(min, Math.round(value)))
          if (settled !== value) onChange(settled)
        }}
        className={fieldClass}
      />
    </label>
  )
}
