import { describe, expect, it } from 'vitest'
import type { CollectionState } from './merge'
import { planMerge } from './merge'

const state = (over: Partial<CollectionState> = {}): CollectionState => ({
  favoriteGames: [],
  favoriteDecks: [],
  folders: [],
  ownedDecks: [],
  hideAdult: false,
  ...over,
})

describe('planMerge', () => {
  it('keeps both sides: signing in loses nothing', () => {
    const plan = planMerge(
      state({ favoriteGames: ['mus', 'brisca'] }),
      state({ favoriteGames: ['tute'] }),
    )
    expect(plan.merged.favoriteGames.sort()).toEqual(['brisca', 'mus', 'tute'])
    expect(plan.gamesToUpload.sort()).toEqual(['brisca', 'mus'])
  })

  it('uploads only what the server is missing', () => {
    const plan = planMerge(
      state({ favoriteDecks: ['tarot-78', 'espanola-40'] }),
      state({ favoriteDecks: ['espanola-40'] }),
    )
    expect(plan.decksToUpload).toEqual(['tarot-78'])
  })

  it('does not duplicate what both already have', () => {
    const plan = planMerge(
      state({ favoriteGames: ['mus'] }),
      state({ favoriteGames: ['mus'] }),
    )
    expect(plan.merged.favoriteGames).toEqual(['mus'])
    expect(plan.gamesToUpload).toEqual([])
  })

  it('creates a folder the server has never seen', () => {
    const plan = planMerge(
      state({ folders: [{ id: 'l1', name: 'viaje', deckSlugs: ['uno-108'] }] }),
      state(),
    )
    expect(plan.foldersToCreate).toEqual([{ name: 'viaje', deckSlugs: ['uno-108'] }])
    expect(plan.merged.folders).toHaveLength(1)
  })

  it('merges the decks of a folder that exists on both sides, matched by name', () => {
    const plan = planMerge(
      state({ folders: [{ id: 'l1', name: 'casa', deckSlugs: ['tarot-78', 'uno-108'] }] }),
      state({ folders: [{ id: 'r1', name: 'casa', deckSlugs: ['espanola-40', 'uno-108'] }] }),
    )
    expect(plan.merged.folders).toHaveLength(1)
    expect(plan.merged.folders[0]?.id).toBe('r1') // the server's row survives
    expect(plan.merged.folders[0]?.deckSlugs.sort())
      .toEqual(['espanola-40', 'tarot-78', 'uno-108'])
    // only the deck the server lacks is sent
    expect(plan.folderDecksToAdd).toEqual([{ name: 'casa', deckSlugs: ['tarot-78'] }])
    expect(plan.foldersToCreate).toEqual([])
  })

  it('leaves the server alone when the local side is empty', () => {
    const plan = planMerge(
      state(),
      state({
        favoriteGames: ['mus'],
        favoriteDecks: ['espanola-40'],
        folders: [{ id: 'r1', name: 'casa', deckSlugs: ['espanola-40'] }],
      }),
    )
    expect(plan.gamesToUpload).toEqual([])
    expect(plan.decksToUpload).toEqual([])
    expect(plan.foldersToCreate).toEqual([])
    expect(plan.folderDecksToAdd).toEqual([])
    expect(plan.merged.favoriteGames).toEqual(['mus'])
  })

  it('unions the deck inventory', () => {
    const plan = planMerge(
      state({ ownedDecks: ['espanola-40'] }),
      state({ ownedDecks: ['francesa-52'] }),
    )
    expect(plan.merged.ownedDecks.sort()).toEqual(['espanola-40', 'francesa-52'])
    expect(plan.ownedToUpload).toEqual(['espanola-40'])
  })

  it('keeps "hide 18+" on if either side asked for it', () => {
    expect(planMerge(state({ hideAdult: true }), state()).merged.hideAdult).toBe(true)
    expect(planMerge(state(), state({ hideAdult: true })).merged.hideAdult).toBe(true)
    expect(planMerge(state(), state()).merged.hideAdult).toBe(false)
  })

  it('is idempotent: merging the result again changes nothing', () => {
    const local = state({ favoriteGames: ['mus'], folders: [{ id: 'l1', name: 'casa', deckSlugs: ['tarot-78'] }] })
    const remote = state({ favoriteGames: ['tute'], folders: [{ id: 'r1', name: 'casa', deckSlugs: ['uno-108'] }] })
    const once = planMerge(local, remote)
    const twice = planMerge(once.merged, once.merged)
    expect(twice.merged).toEqual(once.merged)
    expect(twice.gamesToUpload).toEqual([])
    expect(twice.foldersToCreate).toEqual([])
    expect(twice.folderDecksToAdd).toEqual([])
  })
})
