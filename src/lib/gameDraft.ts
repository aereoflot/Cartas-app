import type { MissingCardsPolicy, RulesSection } from '@/types/cards'

/**
 * A game being written, and the rules for when it is ready to be sent.
 *
 * The specification comes first in the form and in this type, because it is the
 * quick part and it is what makes a game findable: a game with perfect rules and
 * no player count cannot be searched for.
 *
 * Validation lives here, apart from React, so the rules that decide "ready" can
 * be read and tested in one place — and so the form can show the same answer the
 * database would give.
 */

export const SECTION_TEMPLATE = [
  'Objetivo',
  'Preparación',
  'Valor de las cartas',
  'Desarrollo',
  'Puntuación',
  'Fin de la partida',
  'Variantes',
  'Notas',
] as const

/**
 * The one section a game cannot be published without.
 *
 * It used to be three — objective, setup and play — and asking a stranger for
 * three essays before anything could be sent is why the form was abandoned
 * halfway. One is the floor: somebody who has read it can sit down and play.
 * The rest are offered, folded away, for whoever wants to be thorough.
 *
 * The form calls this box "cómo se juega", which is the question an author
 * understands; `Desarrollo` is the heading it is stored and shown under,
 * shared with the nine games that ship with the app.
 */
export const MAIN_SECTION = 'Desarrollo'

/** Offered inside the description step, folded, for whoever wants them. */
export const EXTRA_SECTIONS = SECTION_TEMPLATE.filter(
  (heading) => heading !== MAIN_SECTION && heading !== 'Notas',
)

const REQUIRED_SECTIONS = [MAIN_SECTION] as const

export interface DeckRequirementDraft {
  deckSlug: string
  quantity: number
  note: string
}

export interface GameDraft {
  title: string
  tagline: string
  summary: string
  sections: RulesSection[]
  playersMin: number
  playersMax: number
  playersBest: number | null
  supportsTeams: boolean
  teamSize: number | null
  decks: DeckRequirementDraft[]
  missingCardsPolicy: MissingCardsPolicy
  missingCardsNote: string
  durationMin: number | null
  durationMax: number | null
  complexity: number | null
  ageMin: number | null
  requiresExtras: string[]
  mechanics: string[]
  adultOnly: boolean
  /** the author's word that the wording is theirs; required before sending */
  originalWording: boolean
}

export function emptyDraft(): GameDraft {
  return {
    title: '',
    tagline: '',
    summary: '',
    sections: SECTION_TEMPLATE.map((heading) => ({ heading, body: '' })),
    playersMin: 2,
    playersMax: 4,
    playersBest: null,
    supportsTeams: false,
    teamSize: null,
    decks: [{ deckSlug: 'espanola-40', quantity: 1, note: '' }],
    missingCardsPolicy: 'strict',
    missingCardsNote: '',
    durationMin: null,
    durationMax: null,
    complexity: null,
    ageMin: null,
    requiresExtras: [],
    mechanics: [],
    adultOnly: false,
    originalWording: false,
  }
}

/** i18n keys, so the form and the tests talk about the same problems. */
export type DraftProblem =
  | 'title'
  | 'summary'
  | 'tagline'
  | 'players'
  | 'playersBest'
  | 'teamSize'
  | 'duration'
  | 'age'
  | 'complexity'
  | 'deckQuantity'
  | 'decks'
  | 'sections'
  | 'originalWording'

/** Private keeps it to itself; public has to carry what a reader needs. */
export type Intent = 'private' | 'public'

/**
 * The bounds below are the database's, copied here on purpose.
 *
 * `games` and `game_texts` carry CHECK constraints — a title of 2 to 120
 * characters, a summary of 10 to 600, an age between 3 and 21, 1 to 1440
 * minutes, a team of 2 to 8, 1 to 20 decks of the same kind. Anything outside
 * them comes back as `new row for relation "games" violates check constraint
 * …`, which is true, useless, and frightening.
 *
 * So they are checked here first, in the same words the form can say out loud.
 * Keeping the two in step is a real cost; letting Postgres be the one to tell
 * somebody their game is wrong costs more.
 */
export const LIMITS = {
  title: { min: 2, max: 120 },
  tagline: { max: 160 },
  summary: { min: 10, max: 600 },
  players: { min: 1, max: 64 },
  team: { min: 2, max: 8 },
  duration: { min: 1, max: 1440 },
  complexity: { min: 1, max: 5 },
  age: { min: 3, max: 21 },
  deckQuantity: { min: 1, max: 20 },
} as const

/**
 * The ages worth offering, all inside what the database accepts. A free number
 * box invited "0" for "anybody can play", which is exactly the value the column
 * refuses — the honest way to say that is to leave the age unset.
 */
export const AGE_CHOICES: Array<number | null> = [null, 6, 8, 10, 12, 14, 16, 18]

/**
 * The choices to show, given what this game already says.
 *
 * The column accepts 3 to 21 and the old free-text box let people write any of
 * them, so a stored 7 — two of the games that ship with the app say 7 — would
 * otherwise appear as nothing selected, and the first tap would silently
 * change it. An off-list age gets its own chip instead.
 */
export function ageChoices(current: number | null): Array<number | null> {
  if (current === null || AGE_CHOICES.includes(current)) return AGE_CHOICES
  return [...AGE_CHOICES, current].sort((a, b) => (a ?? 0) - (b ?? 0))
}

/** What the database will refuse outright, whoever the game is for. */
function hardProblems(draft: GameDraft): DraftProblem[] {
  const problems: DraftProblem[] = []
  const title = draft.title.trim()
  const summary = draft.summary.trim()

  if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) problems.push('title')
  if (summary.length < LIMITS.summary.min || summary.length > LIMITS.summary.max) {
    problems.push('summary')
  }
  if (draft.tagline.trim().length > LIMITS.tagline.max) problems.push('tagline')

  if (
    draft.playersMin < LIMITS.players.min ||
    draft.playersMax > LIMITS.players.max ||
    draft.playersMax < draft.playersMin
  ) {
    problems.push('players')
  }
  if (
    draft.playersBest !== null &&
    (draft.playersBest < draft.playersMin || draft.playersBest > draft.playersMax)
  ) {
    problems.push('playersBest')
  }
  if (
    draft.supportsTeams &&
    (draft.teamSize === null ||
      draft.teamSize < LIMITS.team.min ||
      draft.teamSize > LIMITS.team.max)
  ) {
    problems.push('teamSize')
  }

  const outOfRange = (value: number | null, { min, max }: { min: number; max: number }) =>
    value !== null && (value < min || value > max)

  if (
    outOfRange(draft.durationMin, LIMITS.duration) ||
    outOfRange(draft.durationMax, LIMITS.duration) ||
    (draft.durationMin !== null &&
      draft.durationMax !== null &&
      draft.durationMax < draft.durationMin)
  ) {
    problems.push('duration')
  }
  if (outOfRange(draft.ageMin, LIMITS.age)) problems.push('age')
  if (outOfRange(draft.complexity, LIMITS.complexity)) problems.push('complexity')
  if (
    draft.decks.some(
      (deck) =>
        deck.deckSlug !== '' &&
        (deck.quantity < LIMITS.deckQuantity.min || deck.quantity > LIMITS.deckQuantity.max),
    )
  ) {
    problems.push('deckQuantity')
  }

  return problems
}

/**
 * Everything standing between this draft and being saved.
 *
 * Private asks only for what the database demands: a name and a sentence. A
 * deck is not among them — `game_decks` simply gets no row — so a note to
 * yourself stays a two-field job.
 */
export function draftProblems(draft: GameDraft, intent: Intent): DraftProblem[] {
  const problems = hardProblems(draft)
  if (intent === 'private') return problems

  if (draft.decks.length === 0 || draft.decks.every((deck) => deck.deckSlug === '')) {
    problems.push('decks')
  }

  const filled = new Set(
    draft.sections.filter((s) => s.body.trim() !== '').map((s) => s.heading),
  )
  if (REQUIRED_SECTIONS.some((heading) => !filled.has(heading))) problems.push('sections')

  if (!draft.originalWording) problems.push('originalWording')

  return problems
}

/** Sections with nothing written in them are not worth storing or rendering. */
export function usedSections(draft: GameDraft): RulesSection[] {
  return draft.sections
    .map((section) => ({ heading: section.heading.trim(), body: section.body.trim() }))
    .filter((section) => section.heading !== '' && section.body !== '')
}

/**
 * A slug from the title: lower case, no accents, words joined by hyphens. The
 * database requires `^[a-z0-9-]{3,80}$`, so anything that does not survive that
 * falls back to something that does.
 */
export function slugFromTitle(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')

  return slug.length >= 3 ? slug : `juego-${Math.random().toString(36).slice(2, 8)}`
}
