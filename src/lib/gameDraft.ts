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
] as const

/** The three a reader cannot do without. */
const REQUIRED_SECTIONS = ['Objetivo', 'Preparación', 'Desarrollo'] as const

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
  | 'players'
  | 'playersBest'
  | 'teamSize'
  | 'decks'
  | 'duration'
  | 'sections'
  | 'originalWording'

export function validateDraft(draft: GameDraft): DraftProblem[] {
  const problems: DraftProblem[] = []

  if (draft.title.trim().length < 2) problems.push('title')
  if (draft.summary.trim().length < 10) problems.push('summary')

  if (
    draft.playersMin < 1 ||
    draft.playersMax < draft.playersMin ||
    draft.playersMax > 64
  ) {
    problems.push('players')
  }
  if (
    draft.playersBest !== null &&
    (draft.playersBest < draft.playersMin || draft.playersBest > draft.playersMax)
  ) {
    problems.push('playersBest')
  }
  if (draft.supportsTeams && (draft.teamSize === null || draft.teamSize < 2)) {
    problems.push('teamSize')
  }

  if (draft.decks.length === 0 || draft.decks.some((deck) => deck.deckSlug === '')) {
    problems.push('decks')
  }
  if (
    draft.durationMin !== null &&
    draft.durationMax !== null &&
    draft.durationMax < draft.durationMin
  ) {
    problems.push('duration')
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
