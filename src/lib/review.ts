import { supabase } from './supabase'

/**
 * Approving and rejecting submitted games.
 *
 * Two writes per decision, and both matter: the game's status, and a row in
 * `game_reviews` saying who decided what and why. The log is append-only (the
 * client has no update or delete on it), so an author can never be told two
 * different things about the same decision.
 *
 * Who may do this is not decided here: the database only accepts these writes
 * from a profile whose role is owner or moderator.
 */

export async function approveGame(gameId: string, reviewerId: string): Promise<void> {
  if (supabase === null) return

  const { error } = await supabase
    .from('games')
    .update({ status: 'published', reviewed_by: reviewerId })
    .eq('id', gameId)
  if (error !== null) throw new Error(error.message)

  const { error: logError } = await supabase.from('game_reviews').insert({
    game_id: gameId,
    reviewer_id: reviewerId,
    decision: 'approved',
    via: 'app',
  })
  if (logError !== null) throw new Error(logError.message)
}

export async function rejectGame(
  gameId: string,
  reviewerId: string,
  reason: string,
): Promise<void> {
  if (supabase === null) return

  const trimmed = reason.trim()
  // the database refuses a rejection with no reason; catching it here means the
  // author is never left with "no" and no explanation
  if (trimmed === '') throw new Error('reason-required')

  const { error } = await supabase
    .from('games')
    .update({ status: 'rejected', reviewed_by: reviewerId })
    .eq('id', gameId)
  if (error !== null) throw new Error(error.message)

  const { error: logError } = await supabase.from('game_reviews').insert({
    game_id: gameId,
    reviewer_id: reviewerId,
    decision: 'rejected',
    reason: trimmed,
    via: 'app',
  })
  if (logError !== null) throw new Error(logError.message)
}
