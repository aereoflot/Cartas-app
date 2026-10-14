/**
 * Matching what people actually type.
 *
 * Nobody reaches for the accent key to look something up, and on a phone
 * keyboard they shouldn't have to: "poker" has to find "Póker", "chinchon" has
 * to find "Chinchón", and a stray comma or apostrophe must not hide a game.
 *
 * So both sides are folded down to letters and digits — accents stripped, case
 * dropped, punctuation turned into gaps — and then every word typed has to turn
 * up somewhere. Word order does not matter, which is what makes "texas poker"
 * find "Póker Texas hold'em".
 *
 * Words also match run together, so "holdem" finds "hold'em" — the gap is in
 * the name, not in anybody's memory of it.
 *
 * On top of that, one typo is forgiven in words of four letters or more, so
 * "chinchn" and "pokre" still land. One, not two: past that, a search stops
 * narrowing anything and starts guessing.
 */

/** Letters and digits only, lower case, accents gone, gaps where the rest was. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    // combining marks: this is what turns ó into o, and ñ into n
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function queryTokens(query: string): string[] {
  const folded = fold(query)
  return folded === '' ? [] : folded.split(' ')
}

/** Levenshtein, but it gives up as soon as the answer is "more than one". */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false

  // one substitution, or one adjacent transposition ("pokre" for "poker")
  if (a.length === b.length) {
    const differing: number[] = []
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        differing.push(i)
        if (differing.length > 2) return false
      }
    }
    if (differing.length <= 1) return true
    const [first, second] = differing as [number, number]
    return (
      differing.length === 2 &&
      second === first + 1 &&
      a[first] === b[second] &&
      a[second] === b[first]
    )
  }

  // one insertion or deletion: walk both, allowing a single skip
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let skipped = false
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1
      j += 1
      continue
    }
    if (skipped) return false
    skipped = true
    j += 1
  }
  return true
}

/** A typo is forgiven only once the word is long enough for one to be obvious. */
const FUZZY_FROM = 4

function wordMatches(word: string, token: string): boolean {
  if (word.includes(token)) return true
  if (token.length < FUZZY_FROM) return false
  // compare against the start of the word too, so a typo deep in a long name
  // ("chinchn" against "chinchon") is still forgiven
  return (
    withinOneEdit(word, token) ||
    withinOneEdit(word.slice(0, token.length), token) ||
    withinOneEdit(word.slice(0, token.length + 1), token)
  )
}

/**
 * True when every word typed turns up in the haystack, exactly or within one
 * typo. An empty query matches everything, which is what lets the list open
 * before anybody types.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return true

  const folded = fold(haystack)
  if (folded === '') return false
  const words = folded.split(' ')
  // "holdem" for "hold em": the gap between two words is not worth a miss
  const squashed = folded.replace(/ /g, '')

  return tokens.every(
    (token) =>
      folded.includes(token) ||
      squashed.includes(token) ||
      words.some((word) => wordMatches(word, token)),
  )
}
