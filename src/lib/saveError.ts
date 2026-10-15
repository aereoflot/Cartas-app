import type { DraftProblem } from './gameDraft'

/**
 * Turning a database refusal into something worth reading.
 *
 * Postgres says `new row for relation "game_texts" violates check constraint
 * "game_texts_summary_check"`. Every word of that is true and none of it tells
 * somebody what to do, so it arrived on screen in red and looked like the app
 * had broken. The constraint names are stable, so they can be read back into the
 * field they are about.
 *
 * The form checks the same rules before saving (see `LIMITS`), so most of these
 * should never be seen. They are the floor under that, not the plan: a rule
 * added to the schema tomorrow lands here as "no se ha podido guardar" rather
 * than as a stack trace.
 */

/** Field problems share their key with the form's own, so one message serves both. */
export type SaveProblem =
  | DraftProblem
  | 'slugTaken'
  | 'notAllowed'
  | 'signedOut'
  | 'offline'
  | 'unknown'

export class SaveError extends Error {
  constructor(
    readonly problem: SaveProblem,
    /** The original wording, for the line of small print and for the log. */
    readonly detail: string,
  ) {
    super(detail)
    this.name = 'SaveError'
  }
}

/** Constraint name → the field it is about. Checked longest-first. */
const BY_CONSTRAINT: Array<[string, SaveProblem]> = [
  ['game_texts_summary_check', 'summary'],
  ['game_texts_title_check', 'title'],
  ['game_texts_tagline_check', 'tagline'],
  ['games_age_min_check', 'age'],
  ['games_duration_min_check', 'duration'],
  ['games_duration_max_check', 'duration'],
  ['duration_range', 'duration'],
  ['games_players_min_check', 'players'],
  ['games_players_max_check', 'players'],
  ['player_range', 'players'],
  ['best_in_range', 'playersBest'],
  ['games_players_best_check', 'playersBest'],
  ['teams_need_size', 'teamSize'],
  ['games_team_size_check', 'teamSize'],
  ['game_decks_quantity_check', 'deckQuantity'],
  ['games_complexity_check', 'complexity'],
  ['games_slug_check', 'title'],
]

interface Shaped {
  message?: unknown
  code?: unknown
  details?: unknown
}

export function classifySaveError(error: unknown): SaveError {
  const shaped = (error ?? {}) as Shaped
  const message =
    typeof shaped.message === 'string'
      ? shaped.message
      : error instanceof Error
        ? error.message
        : String(error)
  const code = typeof shaped.code === 'string' ? shaped.code : ''
  const haystack = `${message} ${typeof shaped.details === 'string' ? shaped.details : ''}`

  // the request never arrived: a dead connection, a blocker, a wrong host
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return new SaveError('offline', message)
  }

  // a check constraint, named after the column it guards
  if (code === '23514' || /violates check constraint/i.test(haystack)) {
    for (const [name, problem] of BY_CONSTRAINT) {
      if (haystack.includes(name)) return new SaveError(problem, message)
    }
    return new SaveError('unknown', message)
  }

  if (code === '23505' || /duplicate key|already exists/i.test(haystack)) {
    return new SaveError('slugTaken', message)
  }

  // row-level security: the row was refused, not the values
  if (code === '42501' || /row-level security|violates row-level/i.test(haystack)) {
    return new SaveError('notAllowed', message)
  }

  if (code === 'PGRST301' || /jwt|token is expired|not authenticated/i.test(haystack)) {
    return new SaveError('signedOut', message)
  }

  if (/no backend|supabase-not-configured/i.test(message)) {
    return new SaveError('unknown', message)
  }

  return new SaveError('unknown', message)
}
