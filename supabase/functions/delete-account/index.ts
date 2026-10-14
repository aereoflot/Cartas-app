// Cartas - deleting your own account, for real.
//
// Deleting a user needs the service role, which must never reach a browser. So
// it lives here: the caller proves who they are with their own token, and this
// function deletes *that* user and nobody else. The id is taken from the
// verified token, never from the request body, so there is no id to tamper with.
//
// Deploy:
//   supabase functions deploy delete-account --use-api
//
// SUPABASE_SERVICE_ROLE_KEY is provided to edge functions by Supabase itself;
// it is not a secret anyone has to set.

import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json(405, { error: 'method-not-allowed' })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json(401, { error: 'sign-in-required' })

  const asUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )

  const { data: auth } = await asUser.auth.getUser()
  const user = auth?.user
  if (!user) return json(401, { error: 'sign-in-required' })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  // Deleting the account cascades: profile, favourites, folders, the deck
  // inventory, groups owned, group memberships, matches, friendships, AI
  // threads. Games they published are kept but lose their author (the column is
  // ON DELETE SET NULL): the rules stay in the catalogue, the person does not.
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json(500, { error: error.message })

  return json(200, { deleted: true })
})
