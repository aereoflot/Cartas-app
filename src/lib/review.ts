import { publishSnapshot, unpublishGame } from './published'
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

  // Freeze what was just approved as the public version. This, not the status
  // on the author's row, is what readers see — so after this the author can
  // edit or hide their copy and the game stays on the shelf.
  await publishSnapshot(gameId, reviewerId)

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

/**
 * Take a published game down.
 *
 * The answer to a report that turns out to be right, and the only way back
 * through a door that is otherwise one-way. A reviewer's act: an author cannot
 * do this, which is the whole point of the published version living somewhere
 * they cannot write.
 *
 * The author keeps their own copy. Unpublishing a game and deleting somebody's
 * work are different decisions, and only one of them is being made here.
 */
export async function takeDownGame(
  gameId: string,
  reviewerId: string,
  reason: string,
): Promise<void> {
  if (supabase === null) return

  const trimmed = reason.trim()
  if (trimmed === '') throw new Error('reason-required')

  await unpublishGame(gameId)

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
