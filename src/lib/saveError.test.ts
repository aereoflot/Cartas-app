import { describe, expect, it } from 'vitest'
import { classifySaveError } from './saveError'

/** What PostgREST actually hands back, kept verbatim so the mapping is honest. */
const pg = (message: string, code?: string, details?: string) => ({ message, code, details })

describe('classifySaveError', () => {
  it('lee la restricción del resumen, que es la que rompía el guardado en privado', () => {
    const error = pg(
      'new row for relation "game_texts" violates check constraint "game_texts_summary_check"',
      '23514',
    )
    expect(classifySaveError(error).problem).toBe('summary')
  })

  it('lee la restricción de la edad, que era el error "sin sentido" del 0', () => {
    const error = pg(
      'new row for relation "games" violates check constraint "games_age_min_check"',
      '23514',
    )
    expect(classifySaveError(error).problem).toBe('age')
  })

  it('distingue las demás restricciones por su nombre', () => {
    const cases: Array<[string, string]> = [
      ['games_duration_max_check', 'duration'],
      ['duration_range', 'duration'],
      ['player_range', 'players'],
      ['best_in_range', 'playersBest'],
      ['teams_need_size', 'teamSize'],
      ['game_decks_quantity_check', 'deckQuantity'],
      ['game_texts_title_check', 'title'],
    ]
    for (const [constraint, problem] of cases) {
      const error = pg(`violates check constraint "${constraint}"`, '23514')
      expect(classifySaveError(error).problem, constraint).toBe(problem)
    }
  })

  it('reconoce un nombre repetido', () => {
    const error = pg('duplicate key value violates unique constraint "games_slug_key"', '23505')
    expect(classifySaveError(error).problem).toBe('slugTaken')
  })

  it('reconoce un rechazo de permisos, que no es un valor mal puesto', () => {
    const error = pg(
      'new row violates row-level security policy for table "games"',
      '42501',
    )
    expect(classifySaveError(error).problem).toBe('notAllowed')
  })

  it('reconoce una sesión caducada y un servidor inalcanzable', () => {
    expect(classifySaveError(pg('JWT expired', 'PGRST301')).problem).toBe('signedOut')
    expect(classifySaveError(new TypeError('Failed to fetch')).problem).toBe('offline')
  })

  it('guarda el texto original para los detalles técnicos', () => {
    const raw = 'violates check constraint "games_age_min_check"'
    expect(classifySaveError(pg(raw, '23514')).detail).toBe(raw)
  })

  it('una restricción que no conoce no se inventa un campo', () => {
    const error = pg('violates check constraint "games_mañana_check"', '23514')
    expect(classifySaveError(error).problem).toBe('unknown')
  })
})
