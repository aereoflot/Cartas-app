import { describe, expect, it } from 'vitest'
import {
  ADULT_AGE,
  ageFrom,
  checkBirthdate,
  hidesAdultGames,
  parseBirthdate,
  yearsBetween,
} from './age'

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

describe('yearsBetween', () => {
  /*
   * The whole reason this is calendar arithmetic and not a division: with
   * milliseconds and 365.25 days to the year, somebody born on 29 February is
   * still 17 on the morning of their eighteenth birthday.
   */
  it('cuenta el cumpleaños el mismo día, no al día siguiente', () => {
    expect(yearsBetween(day('2008-03-14'), day('2026-03-13'))).toBe(17)
    expect(yearsBetween(day('2008-03-14'), day('2026-03-14'))).toBe(18)
    expect(yearsBetween(day('2008-03-14'), day('2026-03-15'))).toBe(18)
  })

  it('acierta con el 29 de febrero', () => {
    expect(yearsBetween(day('2008-02-29'), day('2026-02-28'))).toBe(17)
    expect(yearsBetween(day('2008-02-29'), day('2026-03-01'))).toBe(18)
  })

  it('acierta a final de mes y a final de año', () => {
    expect(yearsBetween(day('2008-12-31'), day('2026-12-30'))).toBe(17)
    expect(yearsBetween(day('2008-12-31'), day('2026-12-31'))).toBe(18)
    expect(yearsBetween(day('2008-01-01'), day('2026-01-01'))).toBe(18)
  })
})

describe('parseBirthdate', () => {
  it('lee lo que da el calendario del navegador', () => {
    expect(parseBirthdate('1990-07-04')?.getFullYear()).toBe(1990)
    expect(parseBirthdate('1990-07-04')?.getMonth()).toBe(6)
    expect(parseBirthdate('1990-07-04')?.getDate()).toBe(4)
  })

  it('rechaza lo que no es una fecha, incluido el 31 de febrero', () => {
    expect(parseBirthdate('')).toBeNull()
    expect(parseBirthdate('no')).toBeNull()
    expect(parseBirthdate('1990-7-4')).toBeNull()
    // Date lo convertiría en el 3 de marzo sin avisar
    expect(parseBirthdate('1990-02-31')).toBeNull()
    expect(parseBirthdate('1990-13-01')).toBeNull()
  })
})

describe('checkBirthdate', () => {
  const today = day('2026-10-15')

  it('acepta una fecha normal', () => {
    expect(checkBirthdate('1990-07-04', today)).toBeNull()
  })

  it('dice qué está mal, en vez de callarse', () => {
    expect(checkBirthdate('', today)).toBe('empty')
    expect(checkBirthdate('cualquier cosa', today)).toBe('shape')
    expect(checkBirthdate('2027-01-01', today)).toBe('future')
    expect(checkBirthdate('2024-01-01', today)).toBe('tooYoung')
    expect(checkBirthdate('1890-01-01', today)).toBe('tooOld')
  })
})

describe('hidesAdultGames', () => {
  it('esconde los juegos de adultos a quien no tiene la edad', () => {
    expect(hidesAdultGames('2010-01-01', false, day('2026-10-15'))).toBe(true)
  })

  /*
   * The point of storing a date instead of a flag: nobody has to do anything
   * on the birthday, and nobody has to be asked again.
   */
  it('los desbloquea solo el día que cumple los dieciocho', () => {
    const birth = '2008-10-15'
    expect(hidesAdultGames(birth, false, day('2026-10-14'))).toBe(true)
    expect(hidesAdultGames(birth, false, day('2026-10-15'))).toBe(false)
  })

  it('una fecha conocida manda sobre la preferencia antigua', () => {
    // un menor con la casilla desmarcada sigue sin verlos
    expect(hidesAdultGames('2012-01-01', false, day('2026-10-15'))).toBe(true)
    // y un adulto no se queda fuera por una casilla que ya no se puede tocar
    expect(hidesAdultGames('1990-01-01', true, day('2026-10-15'))).toBe(false)
  })

  it('sin fecha, decide lo que esa cuenta eligió en su día', () => {
    expect(hidesAdultGames(null, true, day('2026-10-15'))).toBe(true)
    expect(hidesAdultGames(null, false, day('2026-10-15'))).toBe(false)
  })

  it('la mayoría de edad son dieciocho', () => {
    expect(ADULT_AGE).toBe(18)
    expect(ageFrom('2008-10-15', day('2026-10-15'))).toBe(18)
    expect(ageFrom(null, day('2026-10-15'))).toBeNull()
  })
})
