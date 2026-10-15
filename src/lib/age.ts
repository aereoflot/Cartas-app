/**
 * How old somebody is, and what that means for adult games.
 *
 * The 18+ gate used to be a checkbox in the profile ("hide adult games"), which
 * is a preference rather than a fact: it could be turned off by anybody,
 * including the person it was protecting. A date of birth is asked once and
 * stays true — the day somebody turns eighteen the games appear, with nothing
 * to change and nobody to ask.
 *
 * All of it is pure and dated from an argument, never from `new Date()` inside
 * the function, so "the day of the eighteenth birthday" is a test rather than a
 * thing to find out in production.
 */

/** Old enough to sign up at all. Below this there is no account to make. */
export const MIN_AGE = 6

/** When adult games stop being hidden. */
export const ADULT_AGE = 18

export type BirthdateProblem = 'empty' | 'shape' | 'future' | 'tooYoung' | 'tooOld' | null

/**
 * Whole years between two dates, counting the birthday itself.
 *
 * Done on the calendar rather than by dividing milliseconds: a year is not
 * 365.25 days, and leap years make the division answer 17 on the morning of
 * somebody's eighteenth birthday.
 */
export function yearsBetween(birth: Date, today: Date): number {
  let years = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years -= 1
  return years
}

/** A date from the `<input type="date">` value, or null if it is not one. */
export function parseBirthdate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(year, month - 1, day)
  // rejects 31 February, which Date would roll over to 3 March
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** What is wrong with what somebody typed, so the form can say it out loud. */
export function checkBirthdate(value: string, today: Date): BirthdateProblem {
  if (value.trim() === '') return 'empty'
  const date = parseBirthdate(value)
  if (date === null) return 'shape'
  if (date.getTime() > today.getTime()) return 'future'

  const years = yearsBetween(date, today)
  if (years < MIN_AGE) return 'tooYoung'
  if (years > 120) return 'tooOld'
  return null
}

export function ageFrom(birthdate: string | null, today: Date): number | null {
  if (birthdate === null) return null
  const date = parseBirthdate(birthdate)
  return date === null ? null : yearsBetween(date, today)
}

/**
 * Should adult games be hidden from this person?
 *
 * A known date decides on its own. Without one — every account made before this
 * was asked — the old preference still decides, because that is what those
 * accounts chose and overriding it either locks adults out or lets minors
 * through. Not knowing is not the same as being a minor.
 */
export function hidesAdultGames(
  birthdate: string | null,
  storedPreference: boolean,
  today: Date,
): boolean {
  const age = ageFrom(birthdate, today)
  return age === null ? storedPreference : age < ADULT_AGE
}
