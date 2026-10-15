import { describe, expect, it } from 'vitest'
import type { GameDraft } from './gameDraft'
import {
  AGE_CHOICES,
  ageChoices,
  draftProblems,
  emptyDraft,
  slugFromTitle,
  usedSections,
} from './gameDraft'

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

/** Everything the database would refuse, checked here first. */
const forPublic = (d: GameDraft) => draftProblems(d, 'public')
const forPrivate = (d: GameDraft) => draftProblems(d, 'private')

describe('draftProblems, para publicar', () => {
  it('accepts a draft with the specification and the three key sections', () => {
    expect(forPublic(ready())).toEqual([])
  })

  it('asks for a title and a summary worth reading', () => {
    expect(forPublic(ready({ title: 'x' }))).toContain('title')
    expect(forPublic(ready({ summary: 'corto' }))).toContain('summary')
  })

  it('refuses an impossible player range', () => {
    expect(forPublic(ready({ playersMin: 4, playersMax: 2 }))).toContain('players')
    expect(forPublic(ready({ playersMin: 0 }))).toContain('players')
  })

  it('keeps "best with" inside the range', () => {
    expect(forPublic(ready({ playersMin: 2, playersMax: 4, playersBest: 6 })))
      .toContain('playersBest')
    expect(forPublic(ready({ playersBest: 3 }))).toEqual([])
  })

  it('wants a team size when the game is played in partnerships', () => {
    expect(forPublic(ready({ supportsTeams: true }))).toContain('teamSize')
    expect(forPublic(ready({ supportsTeams: true, teamSize: 2 }))).toEqual([])
  })

  it('needs at least one deck, named', () => {
    expect(forPublic(ready({ decks: [] }))).toContain('decks')
    expect(forPublic(ready({ decks: [{ deckSlug: '', quantity: 1, note: '' }] })))
      .toContain('decks')
  })

  it('refuses a duration that runs backwards', () => {
    expect(forPublic(ready({ durationMin: 40, durationMax: 10 }))).toContain('duration')
  })

  /*
   * One section, not three. Asking a stranger for objective, setup and play
   * before anything could be sent is why the form was abandoned halfway; what
   * a reader cannot do without is being told how the game is played.
   */
  it('pide cómo se juega, y solo eso, de los apartados de reglas', () => {
    const onlyTheMain = ready({
      sections: [
        { heading: 'Objetivo', body: '' },
        { heading: 'Preparación', body: '' },
        { heading: 'Desarrollo', body: 'Por turnos, echa una carta.' },
      ],
    })
    expect(forPublic(onlyTheMain)).toEqual([])

    const withoutTheMain = ready({
      sections: [
        { heading: 'Objetivo', body: 'Ganar.' },
        { heading: 'Preparación', body: 'Reparte tres cartas.' },
        { heading: 'Desarrollo', body: '' },
      ],
    })
    expect(forPublic(withoutTheMain)).toContain('sections')
  })

  it('does not let a game be sent without the author vouching for the wording', () => {
    expect(forPublic(ready({ originalWording: false }))).toContain('originalWording')
  })
})

/*
 * These are the bounds in `games` and `game_texts`. They are tested because the
 * alternative is finding out through `new row for relation "games" violates
 * check constraint …`, which is what used to reach the screen.
 */
describe('draftProblems, los límites de la base de datos', () => {
  it('no deja una edad fuera de 3..21 — el 0 era el fallo real', () => {
    expect(forPrivate(ready({ ageMin: 0 }))).toContain('age')
    expect(forPrivate(ready({ ageMin: 2 }))).toContain('age')
    expect(forPrivate(ready({ ageMin: 22 }))).toContain('age')
    expect(forPrivate(ready({ ageMin: 18 }))).toEqual([])
    // "vale para todos" se dice dejándola sin poner, no con un cero
    expect(forPrivate(ready({ ageMin: null }))).toEqual([])
  })

  it('no deja una duración fuera de 1..1440', () => {
    expect(forPrivate(ready({ durationMin: 0 }))).toContain('duration')
    expect(forPrivate(ready({ durationMax: 2000 }))).toContain('duration')
    expect(forPrivate(ready({ durationMin: 15, durationMax: 60 }))).toEqual([])
  })

  it('no deja un equipo de más de 8 ni una dificultad de más de 5', () => {
    expect(forPrivate(ready({ supportsTeams: true, teamSize: 20 }))).toContain('teamSize')
    expect(forPrivate(ready({ complexity: 9 }))).toContain('complexity')
  })

  it('no deja más de 20 barajas iguales ni un lema kilométrico', () => {
    expect(forPrivate(ready({ decks: [{ deckSlug: 'espanola-40', quantity: 40, note: '' }] })))
      .toContain('deckQuantity')
    expect(forPrivate(ready({ tagline: 'x'.repeat(161) }))).toContain('tagline')
  })

  it('no deja un nombre de una letra ni uno de 200', () => {
    expect(forPrivate(ready({ title: 'x' }))).toContain('title')
    expect(forPrivate(ready({ title: 'x'.repeat(121) }))).toContain('title')
  })
})

describe('draftProblems, en privado', () => {
  it('pide el nombre y una frase, que es lo que exige game_texts', () => {
    const bare = { ...emptyDraft(), title: 'Mi juego' }
    // el resumen es NOT NULL con 10 caracteres mínimo: sin él no se puede guardar
    expect(forPrivate(bare)).toEqual(['summary'])
    expect(forPrivate({ ...bare, summary: 'Un juego para la familia.' })).toEqual([])
  })

  it('no pide baraja, ni reglas, ni la casilla del texto propio', () => {
    const quick = {
      ...emptyDraft(),
      title: 'Nota para mí',
      summary: 'Lo que me contó mi abuela en la cocina.',
      decks: [],
    }
    expect(forPrivate(quick)).toEqual([])
    // lo mismo, para publicar, sí lo pide todo
    expect(forPublic(quick)).toEqual(
      expect.arrayContaining(['decks', 'sections', 'originalWording']),
    )
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

describe('ageChoices', () => {
  it('ofrece las edades de siempre cuando la del juego es una de ellas', () => {
    expect(ageChoices(null)).toEqual(AGE_CHOICES)
    expect(ageChoices(12)).toEqual(AGE_CHOICES)
  })

  /*
   * Two of the nine games that ship with the app say 7, and the old free-text
   * box let anybody write it. Without its own chip it would read as "nothing
   * selected" and the first tap would quietly change the game.
   */
  it('añade la edad guardada cuando no está en la lista, en su sitio', () => {
    expect(ageChoices(7)).toEqual([null, 6, 7, 8, 10, 12, 14, 16, 18])
    expect(ageChoices(21)).toEqual([null, 6, 8, 10, 12, 14, 16, 18, 21])
  })
})
