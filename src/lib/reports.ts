import { supabase } from './supabase'

/**
 * Reporting a game.
 *
 * The table and the rules for it have existed since the first migration; the
 * button did not, which made it the one thing in the schema with no way in.
 *
 * A report goes where a submitted game goes — the owner's review screen — on
 * purpose: those are the same job (somebody looking at a game and deciding) and
 * splitting them across two screens is how one of them gets forgotten.
 *
 * `reporter_id` is the signed-in user by policy (`content_reports_insert`
 * checks it against `auth.uid()`), so a report cannot be filed in somebody
 * else's name.
 */

export const REPORT_REASONS = [
  'wrong-rules',
  'inappropriate',
  'copyright',
  'spam',
  'other',
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

/** The database caps the detail at 1000 characters; the form says so first. */
export const REPORT_DETAIL_MAX = 1000

export async function reportGame(
  reporterId: string,
  gameId: string,
  reason: ReportReason,
  detail: string,
): Promise<void> {
  if (supabase === null) throw new Error('no-backend')

  const trimmed = detail.trim()
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: reporterId,
    target_type: 'game',
    target_id: gameId,
    reason,
    detail: trimmed === '' ? null : trimmed.slice(0, REPORT_DETAIL_MAX),
  })
  if (error !== null) throw new Error(error.message)
}

export interface OpenReport {
  id: string
  gameId: string
  gameSlug: string | null
  gameTitle: string | null
  reason: ReportReason
  detail: string | null
  reporter: string | null
  createdAt: string
}

/**
 * The open reports, for the review screen. Readable only by a reviewer — the
 * policy says so, so this needs no privilege of its own.
 *
 * The game is joined in by hand rather than embedded: `target_id` is a plain
 * uuid with no foreign key, because a report can point at a game, a deck, a
 * comment or a profile.
 */
export async function fetchOpenReports(): Promise<OpenReport[]> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('content_reports')
    .select('id, target_id, reason, detail, created_at, profiles:reporter_id(username)')
    .eq('target_type', 'game')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error !== null) throw new Error(error.message)

  interface Row {
    id: string
    target_id: string
    reason: ReportReason
    detail: string | null
    created_at: string
    profiles: { username: string } | null
  }
  const rows = data as unknown as Row[]
  if (rows.length === 0) return []

  const { data: games } = await supabase
    .from('games')
    .select('id, slug, game_texts(title)')
    .in('id', rows.map((row) => row.target_id))

  interface GameRow {
    id: string
    slug: string
    game_texts: Array<{ title: string }>
  }
  const byId = new Map(
    ((games ?? []) as unknown as GameRow[]).map((row) => [
      row.id,
      { slug: row.slug, title: row.game_texts[0]?.title ?? row.slug },
    ]),
  )

  return rows.map((row) => {
    const game = byId.get(row.target_id)
    return {
      id: row.id,
      gameId: row.target_id,
      gameSlug: game?.slug ?? null,
      gameTitle: game?.title ?? null,
      reason: row.reason,
      detail: row.detail,
      reporter: row.profiles?.username ?? null,
      createdAt: row.created_at,
    }
  })
}

/** Close a report: looked at, decided, done. */
export async function resolveReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase
    .from('content_reports')
    .update({ status })
    .eq('id', reportId)
  if (error !== null) throw new Error(error.message)
}
