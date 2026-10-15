#!/usr/bin/env node
/**
 * Every key the app asks for, against the keys that exist.
 *
 *   npm run check:i18n
 *
 * This exists because a missing key is invisible: i18next renders the key
 * itself, so `auth.problem.wrongLogin` reached the screen as the literal text
 * "auth.problem.wrongLogin" for every wrong password, and nothing failed. The
 * typechecker cannot see it — `t()` takes a string — and no test covered it.
 *
 * Three things are checked:
 *   1. every literal `t('a.b')` in src/ exists in both locales
 *   2. every `t(`a.${x}`)` prefix has at least one key under it, and every
 *      member of that group exists in both locales — which is what catches a
 *      problem code with no wording
 *   3. the two locales have exactly the same keys, and none is empty
 *
 * Unused keys are reported but do not fail: a key waiting for a screen is
 * untidy, a key the screen needs and does not have is a bug.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const problems = []

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

const flatten = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  )

const locales = {}
for (const locale of ['es', 'en']) {
  const raw = JSON.parse(readFileSync(join(ROOT, `src/i18n/${locale}.json`), 'utf8'))
  locales[locale] = new Map(flatten(raw))
}

/* 1 and 2: what the source asks for ------------------------------------- */

const literal = new Set()
const groups = new Set()

for (const file of walk(join(ROOT, 'src'))) {
  if (/\.test\.tsx?$/.test(file)) continue
  const source = readFileSync(file, 'utf8')

  // t('a.b') and t("a.b")
  for (const match of source.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) literal.add(match[1])

  // t(`a.b.${x}`) — the group is everything up to the interpolation
  for (const match of source.matchAll(/\bt\(\s*`([\w.]*?)\$\{/g)) {
    const prefix = match[1].replace(/\.$/, '')
    if (prefix !== '') groups.add(prefix)
  }
}

/**
 * i18next resolves one asked-for key several ways, and all of them count:
 * `deck.cards` is stored as `deck.cards_one` and `deck.cards_other` (plurals),
 * and `match.stakeIdeas` as `match.stakeIdeas.0…3` (a list read with
 * returnObjects). Treating those as missing is how a checker gets switched off.
 */
const resolves = (locale, key) =>
  locales[locale].has(key) ||
  locales[locale].has(`${key}_one`) ||
  locales[locale].has(`${key}_other`) ||
  locales[locale].has(`${key}.0`)

for (const key of [...literal].sort()) {
  for (const locale of ['es', 'en']) {
    if (!resolves(locale, key)) problems.push(`falta ${locale}: ${key}  (t('${key}'))`)
  }
}

/**
 * A group is interpolated two ways: `editor.problem.${p}` picks a child, and
 * `auth.password_${p}` picks a sibling by suffix. The separator decides which.
 */
for (const prefix of [...groups].sort()) {
  const start = prefix.endsWith('_') ? prefix : `${prefix}.`
  const members = [...locales.es.keys()].filter((key) => key.startsWith(start))
  if (members.length === 0) {
    problems.push(`grupo sin ninguna clave: ${start}*`)
    continue
  }
  for (const key of members) {
    if (!locales.en.has(key)) problems.push(`falta en: ${key}  (grupo ${start}*)`)
  }
}

/* 3: the two locales, and nothing empty ---------------------------------- */

for (const key of locales.es.keys()) {
  if (!locales.en.has(key)) problems.push(`solo en es: ${key}`)
}
for (const key of locales.en.keys()) {
  if (!locales.es.has(key)) problems.push(`solo en en: ${key}`)
}

const ALLOWED_EMPTY = new Set(['ai.placeholder.explain', 'ai.placeholder.author'])
for (const locale of ['es', 'en']) {
  for (const [key, value] of locales[locale]) {
    if (typeof value === 'string' && value.trim() === '' && !ALLOWED_EMPTY.has(key)) {
      problems.push(`vacia en ${locale}: ${key}`)
    }
  }
}

/* unused: reported, never fatal ------------------------------------------ */

const asked = new Set()
for (const key of literal) {
  asked.add(key)
  // the forms i18next would have resolved that literal to
  for (const form of [`${key}_one`, `${key}_other`]) {
    if (locales.es.has(form)) asked.add(form)
  }
  for (const stored of locales.es.keys()) {
    if (stored.startsWith(`${key}.`)) asked.add(stored)
  }
}
for (const prefix of groups) {
  const start = prefix.endsWith('_') ? prefix : `${prefix}.`
  for (const key of locales.es.keys()) {
    if (key.startsWith(start)) asked.add(key)
  }
}
const unused = [...locales.es.keys()].filter((key) => !asked.has(key))

console.log(`\n  ${locales.es.size} claves en es, ${locales.en.size} en en`)
console.log(`  ${literal.size} claves literales y ${groups.size} grupos pedidos por el codigo`)

if (unused.length > 0) {
  console.log(`\n  sin usar (${unused.length}):`)
  for (const key of unused.sort()) console.log(`    ${key}`)
}

if (problems.length > 0) {
  console.log(`\n  ${problems.length} problemas:`)
  for (const problem of problems) console.log(`    ${problem}`)
  console.log('')
  process.exit(1)
}

console.log('\n  todas las claves que pide el codigo existen en los dos idiomas\n')
