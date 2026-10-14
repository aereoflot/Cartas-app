import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import type { MissingCardsPolicy } from '@/types/cards'
import type { DraftProblem, GameDraft } from '@/lib/gameDraft'
import { emptyDraft, SECTION_TEMPLATE, validateDraft } from '@/lib/gameDraft'
import { createGame, draftFromGame, updateGame } from '@/lib/gameWrite'
import { useDecks, useGame } from '@/hooks/useCatalogue'
import { useSession } from '@/hooks/useSession'
import { Loading, LoadFailed } from '@/components/QueryState'
import { Collapsible } from '@/components/Collapsible'
import { FilterChip } from '@/components/FilterChip'
import { SignInRequired } from '@/components/SignInRequired'
import { fieldClass } from '@/components/field'

/**
 * Writing a game, one step at a time.
 *
 * The first step is the only one that changes the rest: private or public.
 * Private asks for a title and nothing else — you can park a half-written game
 * and come back — while public has to carry the minimum a reader needs, so each
 * step says what it is still missing instead of a single wall of complaints at
 * the bottom.
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
  basics: ['title', 'summary'],
  players: ['players', 'playersBest', 'teamSize'],
  decks: ['decks'],
  details: ['duration'],
  rules: ['sections'],
  send: ['originalWording'],
}

type Intent = 'private' | 'public'

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
  const problems = validateDraft(draft)

  // Public until told otherwise would quietly demand every field of somebody
  // who only wanted a note to themselves, so nothing is assumed: the first step
  // asks, and until it is answered the rest stay shut.
  const [intent, setIntent] = useState<Intent | null>(null)
  const [open, setOpen] = useState<string>('visibility')

  const set = <K extends keyof GameDraft>(key: K, value: GameDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const stepState = (name: string): 'done' | 'missing' | 'optional' => {
    const mine = STEP_PROBLEMS[name] ?? []
    const unmet = mine.filter((problem) => problems.includes(problem))
    if (unmet.length === 0) return 'done'
    // privately, an empty box is a choice rather than an omission
    return intent === 'private' ? 'optional' : 'missing'
  }

  const chooseIntent = (next: Intent) => {
    setIntent(next)
    setOpen('basics')
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

  const sectionsLeft = SECTION_TEMPLATE.filter(
    (heading) =>
      draft.sections.find((section) => section.heading === heading)?.body.trim() === '',
  )

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
          name="basics"
          title={t('editor.stepBasics')}
          state={stepState('basics')}
          summary={draft.title.trim()}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('players')}
        >
          <Field label={t('editor.gameTitle')}>
            <input
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              maxLength={120}
              className={fieldClass}
            />
          </Field>

          <Field label={t('editor.tagline')} hint={t('editor.taglineHint')}>
            <input
              value={draft.tagline}
              onChange={(event) => set('tagline', event.target.value)}
              maxLength={160}
              className={fieldClass}
            />
          </Field>

          <Field label={t('editor.summary')} hint={t('editor.summaryHint')}>
            <textarea
              value={draft.summary}
              onChange={(event) => set('summary', event.target.value)}
              rows={3}
              maxLength={600}
              className={fieldClass}
            />
          </Field>
        </Step>

        <Step
          n={3}
          name="players"
          title={t('editor.stepPlayers')}
          state={stepState('players')}
          summary={`${draft.playersMin}–${draft.playersMax}`}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('decks')}
        >
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label={t('editor.playersMin')}
              value={draft.playersMin}
              min={1}
              max={64}
              onChange={(value) => set('playersMin', value ?? 1)}
            />
            <NumberField
              label={t('editor.playersMax')}
              value={draft.playersMax}
              min={1}
              max={64}
              onChange={(value) => set('playersMax', value ?? 1)}
            />
            <NumberField
              label={t('editor.playersBest')}
              value={draft.playersBest}
              min={1}
              max={64}
              onChange={(value) => set('playersBest', value)}
            />
          </div>

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
              min={2}
              max={8}
              onChange={(value) => set('teamSize', value)}
            />
          )}
        </Step>

        <Step
          n={4}
          name="decks"
          title={t('editor.stepDecks')}
          state={stepState('decks')}
          summary={String(draft.decks.filter((deck) => deck.deckSlug !== '').length)}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('details')}
        >
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
                    min={1}
                    max={20}
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
          n={5}
          name="details"
          title={t('editor.stepDetails')}
          state="optional"
          summary=""
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('rules')}
        >
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t('editor.durationMin')}
              value={draft.durationMin}
              min={1}
              max={1440}
              onChange={(value) => set('durationMin', value)}
            />
            <NumberField
              label={t('editor.durationMax')}
              value={draft.durationMax}
              min={1}
              max={1440}
              onChange={(value) => set('durationMax', value)}
            />
          </div>

          <Field label={t('search.complexity')}>
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

          <NumberField
            label={t('editor.ageMin')}
            value={draft.ageMin}
            min={3}
            max={21}
            onChange={(value) => set('ageMin', value)}
          />

          <Field label={t('editor.extras')} hint={t('editor.listHint')}>
            <input
              value={draft.requiresExtras.join(', ')}
              onChange={(event) => set('requiresExtras', splitList(event.target.value))}
              className={fieldClass}
            />
          </Field>

          <Field label={t('editor.mechanics')} hint={t('editor.listHint')}>
            <input
              value={draft.mechanics.join(', ')}
              onChange={(event) => set('mechanics', splitList(event.target.value))}
              className={fieldClass}
            />
          </Field>
        </Step>

        <Step
          n={6}
          name="rules"
          title={t('editor.stepRules')}
          state={stepState('rules')}
          summary={`${draft.sections.filter((s) => s.body.trim() !== '').length}`}
          open={open}
          onOpen={setOpen}
          locked={intent === null}
          onNext={() => setOpen('send')}
        >
          <p className="mb-2 text-xs text-muted">{t('editor.rulesHint')}</p>
          <div className="rounded-card border border-line">
            {draft.sections.map((section, index) => {
              const required = ['Objetivo', 'Preparación', 'Desarrollo'].includes(section.heading)
              return (
                <Collapsible
                  key={section.heading}
                  title={`${section.heading}${required ? ' *' : ''}`}
                  summary={section.body.trim() === '' ? '' : '✓'}
                  defaultOpen={required && section.body.trim() === ''}
                >
                  <textarea
                    value={section.body}
                    onChange={(event) => {
                      const next = [...draft.sections]
                      next[index] = { ...section, body: event.target.value }
                      set('sections', next)
                    }}
                    rows={5}
                    aria-label={section.heading}
                    className={fieldClass}
                  />
                </Collapsible>
              )
            })}
          </div>
          {sectionsLeft.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {t('editor.sectionsLeft', { list: sectionsLeft.join(', ') })}
            </p>
          )}
        </Step>

        <Step
          n={7}
          name="send"
          title={intent === 'private' ? t('editor.stepSave') : t('editor.stepSend')}
          state={stepState('send')}
          summary=""
          open={open}
          onOpen={setOpen}
          locked={intent === null}
        >
          <div className="space-y-3">
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

            {warnRepublish && (
              <p className="rounded-card border border-warn/40 px-4 py-3 text-sm text-warn">
                {t('editor.republishWarning')}
              </p>
            )}

            <p className="text-xs leading-relaxed text-muted">
              {intent === 'private' ? t('editor.privateNote') : t('editor.publicNote')}
            </p>

            {intent === 'public' && problems.length > 0 && (
              <ul className="space-y-1 rounded-card border border-dashed border-line px-4 py-3 text-sm text-muted">
                {problems.map((problem: DraftProblem) => (
                  <li key={problem}>· {t(`editor.problem.${problem}`)}</li>
                ))}
              </ul>
            )}

            {intent === 'public' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={draft.title.trim() === '' || save.isPending}
                  onClick={() => save.mutate('draft')}
                  className="flex-1 rounded-full border border-line px-4 py-3 font-medium disabled:opacity-50"
                >
                  {t('editor.savePrivate')}
                </button>
                <button
                  type="button"
                  disabled={problems.length > 0 || save.isPending}
                  onClick={() => save.mutate('pending_review')}
                  className="flex-1 rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
                >
                  {t('editor.submit')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={draft.title.trim() === '' || save.isPending}
                onClick={() => save.mutate('draft')}
                className="w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
              >
                {t('editor.savePrivate')}
              </button>
            )}

            {save.isSuccess && <p className="text-sm text-accent">{t('editor.saved')}</p>}
            {save.error !== null && (
              <p role="alert" className="text-sm text-danger">
                {save.error instanceof Error ? save.error.message : String(save.error)}
              </p>
            )}
          </div>
        </Step>
      </div>
    </div>
  )
}

/**
 * One step of the form: a row you tap to open, with its number and how it
 * stands. Only one is open at a time, so a long form reads as a short list of
 * decisions rather than a page that never ends — and the state on the right
 * means you can see what is left without opening anything.
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
        <span className="shrink-0 text-xs text-muted">
          {state === 'missing' && !isOpen ? t('editor.stepMissing') : ''}
        </span>
        <span className="shrink-0 text-muted" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-3 px-4 pb-4">
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
        className={fieldClass}
      />
    </label>
  )
}
