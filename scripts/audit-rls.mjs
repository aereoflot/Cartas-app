#!/usr/bin/env node
/**
 * Verifies row-level security from the client's side, with the public anon key
 * — the key that ships in the app, so this is the view everyone already has.
 *
 *   node scripts/audit-rls.mjs
 *
 * `npm run check:remote` confirms the honest read paths parse and return what
 * they should. This is the complement: it confirms the *dishonest* paths are
 * refused — that a visitor, and an ordinary signed-in user, cannot read what is
 * private, write what is not theirs, or change their own role. Each line says
 * what was attempted and what the correct answer is, so a pass reads as "tried
 * and refused" rather than "nothing happened".
 *
 * It runs on a throwaway account, created at the start and deleted at the end
 * through the same edge function the app uses, so no real row is touched.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = line.indexOf('=')
  if (i > 0 && !line.trimStart().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !KEY) {
  console.error('.env.local has no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(2)
}

let refused = 0
const holes = []
const line = (ok, label, detail) => {
  console.log(`  ${ok ? 'refused ' : '** HOLE '} ${label}${detail ? `  — ${detail}` : ''}`)
  if (ok) refused += 1
  else holes.push(label)
}

/** A read defends correctly when it errors or comes back empty. */
const readBlocked = (label, { data, error }) => {
  if (error !== null) return line(true, label, `refused: ${error.code ?? error.message}`)
  const rows = data ?? []
  if (rows.length === 0) return line(true, label, 'returned nothing')
  line(false, label, `read ${rows.length} row(s): ${JSON.stringify(rows[0]).slice(0, 110)}`)
}

/** A write defends correctly when it errors or affects no row. */
const writeBlocked = (label, { data, error }) => {
  if (error !== null) return line(true, label, `${error.code ?? ''} ${error.message}`.trim().slice(0, 90))
  if ((data ?? []).length === 0) return line(true, label, 'affected no row')
  line(false, label, `wrote: ${JSON.stringify(data[0]).slice(0, 110)}`)
}

console.log(`\n${URL_}\n`)

// ---------------------------------------------------------------- anon visitor
const anon = createClient(URL_, KEY)

console.log('as an anonymous visitor')
readBlocked('cannot read a private setting (birth date)',
  await anon.from('profile_settings').select('profile_id, birthdate').not('birthdate', 'is', null))
readBlocked('cannot read anybody\'s match history',
  await anon.from('matches').select('id, profile_id'))
readBlocked('cannot read a deck folder',
  await anon.from('deck_folders').select('id, name'))
readBlocked('cannot read a group chat message',
  await anon.from('group_messages').select('id, body'))
readBlocked('cannot read a friendship',
  await anon.from('friendships').select('requester_id, addressee_id'))
readBlocked('cannot read the review log',
  await anon.from('game_reviews').select('id, reason'))
readBlocked('cannot read an unpublished (draft) game',
  await anon.from('games').select('id, slug').neq('status', 'published'))
readBlocked('cannot read open reports',
  await anon.from('content_reports').select('id, detail'))
writeBlocked('cannot insert a game',
  await anon.from('games').insert({ slug: `attack-${Date.now()}`, status: 'published', players_min: 2, players_max: 4 }).select())
writeBlocked('cannot write a published version onto the public shelf',
  await anon.from('game_versions').insert({ game_id: '00000000-0000-0000-0000-000000000000', slug: 'x', payload: {} }).select())

// confirm that what SHOULD be public still is, so the audit is not just a wall
{
  const { data } = await anon.from('games').select('id').eq('status', 'published').limit(1)
  line((data ?? []).length > 0, 'published games are still readable (sanity)', `${(data ?? []).length} row`)
}

// ------------------------------------------------------- an ordinary signed-in user
const tag = Math.random().toString(36).slice(2, 8)
const email = `audit-${tag}@gmail.com`
const password = `Prueba-${tag}-xyz`
const user = createClient(URL_, KEY)
const { data: signed, error: signUpError } = await user.auth.signUp({
  email, password, options: { data: { username: `audit_${tag}`, birthdate: '1990-01-01' } },
})
if (signUpError) {
  console.log(`\n  (could not create the throwaway account: ${signUpError.message})`)
  process.exit(1)
}
const myId = signed.user.id

console.log('\nas an ordinary signed-in user')

// find somebody else to aim at
const { data: others } = await user.from('profiles').select('id, username').neq('id', myId).limit(1)
const victimId = others?.[0]?.id ?? '00000000-0000-0000-0000-000000000000'

readBlocked('cannot read another user\'s birth date',
  await user.from('profile_settings').select('profile_id, birthdate').eq('profile_id', victimId))
readBlocked('cannot read another user\'s matches',
  await user.from('matches').select('id').eq('profile_id', victimId))
readBlocked('cannot read another user\'s folders',
  await user.from('deck_folders').select('id').eq('profile_id', victimId))
writeBlocked('cannot make itself the owner',
  await user.from('profiles').update({ role: 'owner' }).eq('id', myId).select())
writeBlocked('cannot make itself a moderator',
  await user.from('profiles').update({ role: 'moderator' }).eq('id', myId).select())
writeBlocked('cannot rename another user\'s profile',
  await user.from('profiles').update({ display_name: 'hijacked' }).eq('id', victimId).select())
writeBlocked('cannot publish its own game straight to published',
  await user.from('games').insert({ slug: `audit-pub-${tag}`, author_id: myId, status: 'published', players_min: 2, players_max: 4 }).select())
writeBlocked('cannot write to the review log',
  await user.from('game_reviews').insert({ game_id: '00000000-0000-0000-0000-000000000000', reviewer_id: myId, decision: 'approved' }).select())
writeBlocked('cannot put a game on the public shelf (game_versions)',
  await user.from('game_versions').insert({ game_id: '00000000-0000-0000-0000-000000000000', slug: `audit-${tag}`, payload: {} }).select())
writeBlocked('cannot file a report in somebody else\'s name',
  await user.from('content_reports').insert({ reporter_id: victimId, target_type: 'game', target_id: '00000000-0000-0000-0000-000000000000', reason: 'spam' }).select())
writeBlocked('cannot set a birth date outside the allowed range',
  await user.from('profile_settings').upsert({ profile_id: myId, birthdate: '1700-01-01' }, { onConflict: 'profile_id' }).select())

// clean up through the edge function, as the app does
const token = (await user.auth.getSession()).data.session?.access_token
const res = await fetch(`${URL_}/functions/v1/delete-account`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}` },
})
console.log(`\n  cleanup: throwaway account ${res.ok ? 'deleted' : `NOT deleted (HTTP ${res.status})`}`)

console.log(`\n  ${refused} attempts refused, ${holes.length} holes`)
if (holes.length > 0) {
  for (const h of holes) console.log(`    HOLE: ${h}`)
  process.exit(1)
}
console.log('  every unauthorized read and write was refused\n')
