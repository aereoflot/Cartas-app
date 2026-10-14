import { describe, expect, it } from 'vitest'
import type { GameDraft } from './gameDraft'
import { emptyDraft, slugFromTitle, usedSections, validateDraft } from './gameDraft'

const ready = (over: Partial<GameDraft> = {}): GameDraft => ({
  ...emptyDraft(),
  title: 'Mi juego',
  summary: 'Un juego de cartas para jugar en casa con la familia.',
  sections: [
    { heading: 'Objetivo', body: 'Ganar.' },
    { heading: 'Preparación', body: 'Reparte tres cartas.' },
    { heading: 'Desarrollo', body: 'Por turnos, echa una carta.' },
    { heading: 'Variantes', body: '' },
  ],
  originalWording: true,
  ...over,
})

describe('validateDraft', () => {
  it('accepts a draft with the specification and the three key sections', () => {
    expect(validateDraft(ready())).toEqual([])
  })

  it('asks for a title and a summary worth reading', () => {
    expect(validateDraft(ready({ title: 'x' }))).toContain('title')
    expect(validateDraft(ready({ summary: 'corto' }))).toContain('summary')
  })

  it('refuses an impossible player range', () => {
    expect(validateDraft(ready({ playersMin: 4, playersMax: 2 }))).toContain('players')
    expect(validateDraft(ready({ playersMin: 0 }))).toContain('players')
  })

  it('keeps "best with" inside the range', () => {
    expect(validateDraft(ready({ playersMin: 2, playersMax: 4, playersBest: 6 })))
      .toContain('playersBest')
    expect(validateDraft(ready({ playersBest: 3 }))).toEqual([])
  })

  it('wants a team size when the game is played in partnerships', () => {
    expect(validateDraft(ready({ supportsTeams: true }))).toContain('teamSize')
    expect(validateDraft(ready({ supportsTeams: true, teamSize: 2 }))).toEqual([])
  })

  it('needs at least one deck, named', () => {
    expect(validateDraft(ready({ decks: [] }))).toContain('decks')
    expect(validateDraft(ready({ decks: [{ deckSlug: '', quantity: 1, note: '' }] })))
      .toContain('decks')
  })

  it('refuses a duration that runs backwards', () => {
    expect(validateDraft(ready({ durationMin: 40, durationMax: 10 }))).toContain('duration')
  })

  it('requires objective, setup and play, not the optional ones', () => {
    const without = ready({
      sections: [
        { heading: 'Objetivo', body: 'Ganar.' },
        { heading: 'Preparación', body: '' },
        { heading: 'Desarrollo', body: 'Se juega.' },
      ],
    })
    expect(validateDraft(without)).toContain('sections')
  })

  it('does not let a game be sent without the author vouching for the wording', () => {
    expect(validateDraft(ready({ originalWording: false }))).toContain('originalWording')
  })
})

describe('usedSections', () => {
  it('drops the empty ones and trims the rest', () => {
    const sections = usedSections(ready({
      sections: [
        { heading: 'Objetivo', body: '  Ganar.  ' },
        { heading: 'Variantes', body: '   ' },
      ],
    }))
    expect(sections).toEqual([{ heading: 'Objetivo', body: 'Ganar.' }])
  })
})

describe('slugFromTitle', () => {
  it('makes something the database accepts', () => {
    expect(slugFromTitle('Chinchón')).toBe('chinchon')
    expect(slugFromTitle('Escoba de 15')).toBe('escoba-de-15')
    expect(slugFromTitle('  Póker  Texas  ')).toBe('poker-texas')
    expect(slugFromTitle('Tute cabrón!')).toBe('tute-cabron')
  })

  it('falls back when nothing usable survives', () => {
    expect(slugFromTitle('¡!¿?')).toMatch(/^juego-[a-z0-9]{4,6}$/)
    expect(slugFromTitle('ab')).toMatch(/^juego-/)
  })

  it('never ends in a hyphen, even when cut at 80 characters', () => {
    const slug = slugFromTitle('a'.repeat(79) + ' b')
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
  })
})
