import type { Game } from '@/types/cards'
import type { GameDraft } from './gameDraft'
import { emptyDraft, slugFromTitle, SECTION_TEMPLATE, usedSections } from './gameDraft'
import { classifySaveError, SaveError } from './saveError'
import { supabase } from './supabase'

/**
 * Writing a game: as a draft nobody else sees, or submitted for review.
 *
 * An author can only ever write a row whose status is `draft` or
 * `pending_review` — the database refuses `published` from a client — so
 * publishing is the reviewer's act, not a flag this code could set.
 */

export type SaveStatus = 'draft' | 'pending_review'

/** Turn a game that is already stored back into something the form can edit. */
export function draftFromGame(game: Game): GameDraft {
  const base = emptyDraft()
  const byHeading = new Map(game.sections.map((section) => [section.heading, section.body]))

  return {
    ...base,
    title: game.title,
    tagline: game.tagline ?? '',
    summary: game.summary,
    // keep the template order, then anything the author added beyond it
    sections: [
      ...SECTION_TEMPLATE.map((heading) => ({ heading, body: byHeading.get(heading) ?? '' })),
      ...game.sections.filter((section) => !SECTION_TEMPLATE.includes(
        section.heading as (typeof SECTION_TEMPLATE)[number],
      )),
    ],
    playersMin: game.playersMin,
    playersMax: game.playersMax,
    playersBest: game.playersBest ?? null,
    supportsTeams: game.supportsTeams,
    teamSize: game.teamSize ?? null,
    decks: game.decks.map((deck) => ({
      deckSlug: deck.deckSlug,
      quantity: deck.quantity,
      note: deck.note ?? '',
    })),
    missingCardsPolicy: game.missingCardsPolicy,
    missingCardsNote: game.missingCardsNote ?? '',
    durationMin: game.durationMin ?? null,
    durationMax: game.durationMax ?? null,
    complexity: game.complexity ?? null,
    ageMin: game.ageMin ?? null,
    requiresExtras: game.requiresExtras,
    mechanics: game.mechanics,
    adultOnly: game.adultOnly,
    // the attestation is made again on every send, deliberately
    originalWording: false,
  }
}

function specRow(draft: GameDraft, status: SaveStatus) {
  return {
    status,
    // Private means private in the row too, not merely unpublished: a draft
    // used to be stored as `public` and kept out of sight by its status alone,
    // which is one forgotten filter away from being a leak.
    visibility: status === 'draft' ? 'private' : 'public',
    listed: status !== 'draft',
    primary_locale: 'es',
    players_min: draft.playersMin,
    players_max: draft.playersMax,
    players_best: draft.playersBest,
    supports_teams: draft.supportsTeams,
    team_size: draft.supportsTeams ? draft.teamSize : null,
    missing_cards_policy: draft.missingCardsPolicy,
    missing_cards_note: draft.missingCardsNote.trim() === '' ? null : draft.missingCardsNote.trim(),
    duration_min: draft.durationMin,
    duration_max: draft.durationMax,
    complexity: draft.complexity,
    age_min: draft.ageMin,
    requires_extras: draft.requiresExtras,
    mechanics: draft.mechanics,
    adult_only: draft.adultOnly,
  }
}

/** The slug is derived from the title; a clash gets a number rather than an error. */
async function freeSlug(wanted: string): Promise<string> {
  if (supabase === null) return wanted

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? wanted : `${wanted.slice(0, 76)}-${attempt + 1}`
    const { data, error } = await supabase
      .from('games')
      .select('slug')
      .eq('slug', candidate)
      .maybeSingle()
    if (error !== null) throw classifySaveError(error)
    if (data === null) return candidate
  }
  return `${wanted.slice(0, 70)}-${Math.random().toString(36).slice(2, 7)}`
}

async function writeTextAndDecks(gameId: string, draft: GameDraft): Promise<void> {
  if (supabase === null) return

  const { error: textError } = await supabase.from('game_texts').upsert(
    {
      game_id: gameId,
      locale: 'es',
      title: draft.title.trim(),
      tagline: draft.tagline.trim() === '' ? null : draft.tagline.trim(),
      summary: draft.summary.trim(),
      sections: usedSections(draft),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'game_id,locale' },
  )
  if (textError !== null) throw classifySaveError(textError)

  const slugs = draft.decks.map((deck) => deck.deckSlug)
  const { data: deckRows, error: deckError } = await supabase
    .from('decks')
    .select('id, slug')
    .in('slug', slugs)
  if (deckError !== null) throw classifySaveError(deckError)

  const idBySlug = new Map((deckRows as Array<{ id: string; slug: string }>)
    .map((row) => [row.slug, row.id]))

  const rows = draft.decks
    .map((deck) => {
      const deckId = idBySlug.get(deck.deckSlug)
      if (deckId === undefined) return null
      return {
        game_id: gameId,
        deck_id: deckId,
        quantity: deck.quantity,
        note: deck.note.trim() === '' ? null : deck.note.trim(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (rows.length > 0) {
    const { error } = await supabase
      .from('game_decks')
      .upsert(rows, { onConflict: 'game_id,deck_id' })
    if (error !== null) throw classifySaveError(error)
  }

  // a deck the author removed from the list must go, or the requirements would lie
  const keep = rows.map((row) => row.deck_id)
  const drop = supabase.from('game_decks').delete().eq('game_id', gameId)
  const { error: dropError } = await (keep.length === 0
    ? drop
    : drop.not('deck_id', 'in', `(${keep.join(',')})`))
  if (dropError !== null) throw classifySaveError(dropError)
}

export interface SavedGame {
  id: string
  slug: string
}

export async function createGame(
  authorId: string,
  draft: GameDraft,
  status: SaveStatus,
): Promise<SavedGame> {
  if (supabase === null) throw new SaveError('unknown', 'no backend')

  const slug = await freeSlug(slugFromTitle(draft.title))
  const { data, error } = await supabase
    .from('games')
    .insert({ ...specRow(draft, status), slug, author_id: authorId })
    .select('id, slug')
    .single()
  if (error !== null) throw classifySaveError(error)

  const saved = data as SavedGame
  await writeTextAndDecks(saved.id, draft)
  return saved
}

export async function updateGame(
  gameId: string,
  draft: GameDraft,
  status: SaveStatus,
): Promise<void> {
  if (supabase === null) return

  const { error } = await supabase.from('games').update(specRow(draft, status)).eq('id', gameId)
  if (error !== null) throw classifySaveError(error)
  await writeTextAndDecks(gameId, draft)
}

/** The author's own games, whatever their state, for the "my games" list. */
export async function listMyGames(authorId: string): Promise<Array<{
  id: string
  slug: string
  status: string
  title: string
  reason: string | null
}>> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('games')
    .select('id, slug, status, game_texts(title), game_reviews(decision, reason, created_at)')
    .eq('author_id', authorId)
    .order('updated_at', { ascending: false })
  if (error !== null) throw classifySaveError(error)

  interface Row {
    id: string
    slug: string
    status: string
    game_texts: Array<{ title: string }>
    game_reviews: Array<{ decision: string; reason: string | null; created_at: string }>
  }

  return (data as unknown as Row[]).map((row) => {
    const last = [...row.game_reviews].sort((a, b) =>
      b.created_at.localeCompare(a.created_at))[0]
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      title: row.game_texts[0]?.title ?? row.slug,
      reason: row.status === 'rejected' ? (last?.reason ?? null) : null,
    }
  })
}
