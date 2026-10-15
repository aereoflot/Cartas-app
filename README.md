# Cartas

An open platform for card games: rules you can actually follow at the table, games anyone can
publish, decks you can invent, and friends to play them with.

Read [`docs/product-spec.md`](docs/product-spec.md) for what it is, and
[`docs/data-model.md`](docs/data-model.md) for how the data is shaped and why.

## What it is

- **A rules library.** Every game states what it needs before you start: how many players, which
  deck(s) and how many of them, whether a missing 7 of copas ruins it, how long a round takes.
- **Open.** Any signed-in user submits a game; the owner approves it before it goes public.
- **Deck-aware.** Spanish 40 and 48, French 52/54/32, German 32, tarot, Uno — and decks users
  build themselves.
- **Social.** Friends found by handle, groups, a group chat, and a prize you can agree on.
- **A companion for the table.** Starting a match opens a minimal panel: game name and match timer
  on top, then notes, a tally, a round timer, the rules and the AI referee. Works offline.
- **An AI card expert.** Explains a game another way, referees from the rules text, and suggests
  what to play from games that actually exist here.

## Stack

| Layer | Choice |
|---|---|
| App | React 19 + TypeScript + Vite, phone-first |
| Routing / data | React Router, TanStack Query |
| Styling | Tailwind CSS v4, design tokens, light + dark |
| i18n | i18next, Spanish default, English complete |
| Backend | Supabase — Postgres + RLS, Auth, Edge Functions |
| AI | Claude (`claude-opus-5-5`) behind an edge function; the key never reaches the client |

## Getting started

Node 20+ and a POSIX shell. The Windows Node on this machine cannot resolve WSL paths, so Node
lives in `~/.local/node`; `./start.sh` puts it on `PATH` for you.

```bash
npm install
./start.sh                             # http://localhost:5173
npm run build                          # typecheck + production build
npm test                               # 196 app tests (vitest + jsdom)
npm run test:schema                    # migrations on a throwaway Postgres, 51 assertions
npm run check:remote                   # the app's real queries against the live project
npm run check:i18n                     # every key the code asks for, in both languages
python3 supabase/migrate.py --status   # which migrations are applied
python3 supabase/migrate.py            # apply the pending ones
python3 supabase/live_check.py         # write paths, on throwaway accounts it then deletes
python3 supabase/run_sql.py <file.sql> # a one-off script
```

`npm run test:schema` needs no Docker and no Supabase account: it downloads a prebuilt Postgres 17
into `~/.cache/cartas-pgtest/` on first run.

The Python scripts that talk to the live project (`migrate.py`, `live_check.py`, `run_sql.py`,
`verify_functions.py`) need one dependency: `pip install pg8000`. On a Debian-managed Python that
refuses to install into the system (PEP 668), a virtualenv is the way:
`python3 -m venv .venv && .venv/bin/pip install pg8000 && .venv/bin/python supabase/migrate.py`.

`npm run check:i18n` exists because a missing translation key is invisible: i18next renders the key
itself, so `auth.problem.wrongLogin` reached the screen as that literal text for every wrong
password, and neither the typechecker nor a test could see it.

## What works

- **Home** — short on purpose: a match to resume, the search box, your favourites. Tapping the box
  opens the list; typing narrows it. No result counts, and no search tab in the bottom bar.
- **Filters** — a panel in place, never another page, in collapsible submenus with one **Apply**
  button and a count on the button. They live in the URL, so a filtered search is a link.
- **Favourites** — a star on every game and deck card; starred things go to the top and onto the
  home screen.
- **Decks** — three at rest (favourites first), the rest when you tap the box. Folders you name,
  with **Add decks** on each one. **"I own it"** on a deck feeds the *only games I can play* filter.
- **Game page** — requirements before rules: players, decks, duration, extras, and whether a
  missing card ruins it. Collapsible rules with a jump list.
- **Match panel** — notes (autosaved), a tally with per-player totals, a round timer, the rules,
  the referee. Minimal bar: game name, the stake, total time. Entirely offline-capable.
- **"What are we playing for?"** — an optional free-text stake, last in the setup form, visible all
  match and kept in the history.
- **Friends** — found by **handle**, never by email. Request, accept, decline, see who is waiting.
- **Groups** — members are either real friends (who get the chat) or plain names for whoever has no
  account; the chip says which. Your matches together, and the chat.
- **Publishing** — five questions: name, short description, description, what you need, notes. Each
  one a drawer that says whether it is complete, what is missing, and why — in the same words the
  database would use. Saving privately asks for the two things a game cannot be stored without (a
  name and a sentence); submitting also asks how it is played and which deck. **Your games** on your
  profile shows where each one stands in a sentence, and a rejection carries its reason.
- **Published is published** — the approved version of a game is frozen in `game_versions`, which is
  what the public catalogue reads. An author editing or hiding their own copy cannot take a game off
  the shelf for people who are already playing it; only a reviewer can, by taking it down, which is
  the answer to a report. See migration `0010`.
- **Reporting** — a flag in the corner of every game. Reports land on the same review screen as
  submitted games, because they are the same job: somebody looking at a game and deciding.
- **Reviewing** — `/admin/review` for the owner: every submitted game shown exactly as a reader
  will see it, approve or reject with a reason, logged in `game_reviews`.
- **The expert** — explain / referee / suggest, streamed. Needs the edge function deployed and an
  Anthropic key; until then the screen says exactly that and what to run.
- **18+** — a date of birth, asked once when the account is made and never again. It replaces a
  *hide adult games* checkbox, which was a preference rather than an age: anybody could untick it,
  including whoever it existed to protect. A date keeps being true, so the games appear by
  themselves on the eighteenth birthday, with nobody to ask. It lives in `profile_settings`, which
  only its owner can read. A one-time advisory still comes before any adult game.
- **Sign-in** — a handle, an email and a password; nothing to confirm. A forgotten password is
  recovered by an emailed link (`/nueva-contrasena`).
- **Your account** — the profile is drawers now: account (name, handle, email, password), your
  games, matches and friends, installing, privacy and deletion. The handle is editable; it was fixed
  on the grounds of being "the only door you have", which stopped being true when accounts got an
  email address to sign in with.
- **Offline** — a line under the header while there is no signal, for somebody signed in: everything
  keeps working, nothing is lost, and nothing is being saved to the account until it is back.

## Local first, account second

Every screen reads and writes **local storage**, synchronously. That is why starring is instant and
why the match panel works on a train. When somebody signs in, a sync engine sits beside that store
(`src/lib/sync.ts`):

| when | what it does |
|---|---|
| first sign-in on a device | pulls the account, **unions** it with what is here, pushes the union |
| later sign-ins | pulls and adopts: the account wins, which is what makes a second device work |
| every local change | pushes the whole collection, debounced |

Favourites, deck folders, the deck inventory, the hide-18+ setting, groups and **match history** all
follow the account. The union rule means signing in never throws anything away; folders and groups
are matched by name. Match history merges per match id, newest `updatedAt` winning, so the notes
somebody is still typing are not overwritten by an older copy.

Pure functions with their own tests: `src/lib/merge.ts`, `groupMerge.ts`, `matchMerge.ts` — each
tested for idempotence, because a sync that is not idempotent breaks on the second run.

**The known limit, stated rather than hidden:** a favourite removed while *signed out* comes back
if the account still has it, because a union cannot tell "deleted here" from "never seen here".
Tombstones would fix it and are not worth it for a list of starred decks. Signed in, every change
goes straight up and deletes stick.

A push that fails says so on the profile screen. A sync that quietly fails is worse than none.

## Content

Nine games ship with the app: **brisca, chinchón, escoba de 15, mus, tute, guiñote, cuarenta, Texas
hold'em** and **solitario (Klondike)**, written from scratch for this repo in Spanish.

The content lives once, in [`supabase/content/games.py`](supabase/content/games.py), and
`python3 supabase/gen_games.py` generates both the seed migration and the no-backend fallback
(`src/lib/sampleGames.ts`). Same for the decks (`gen_decks.py` → `0002` and `src/lib/decks.ts`).
Edit the content, regenerate, never edit an output by hand.

**Cuarenta** is the one game whose scoring genuinely varies by region, so its rules say which parts
to agree on first, and its deck is `francesa-52` with `cards_removed: ["8","9","10"]`. The seeded
games carry **no ratings**: inventing stars for games nobody rated is fake social proof, and a
schema test enforces it.

### The migrations are pure ASCII, on purpose

Accents travel as JSON unicode escapes inside `jsonb` and as base64 for text columns;
`supabase/sqlgen.py` asserts it. Not style: pasting the UTF-8 version through the Windows clipboard
once wrote `Baraja espa├▒ola` and `ÔÖú ÔÖª ÔÖÑ ÔÖá` into the live database. ASCII output removes the
failure mode instead of asking anyone to remember an encoding flag, and because the content inserts
upsert, re-running `apply-content.sql` repairs rows already written wrong. `npm run check:remote`
fails loudly on any mojibake.

## Connecting Supabase

`python3 supabase/migrate.py` applies pending migrations straight to the project, each in its own
transaction, recording them in `schema_migrations` so nothing runs twice. It needs `supabase/.env`
(git-ignored) with `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` — the **database** password
from Settings → Database, not the account login. TLS is verified against Supabase's own root, kept
at `supabase/supabase-root-2021-ca.crt`. `--mark-applied` adopts a database that was migrated by
hand, and refuses unless the expected tables are really there.

Without that password the same files can be pasted into the SQL Editor:
`supabase/apply-to-supabase.sql` for an empty project, `supabase/apply-content.sql` for decks and
games on an existing one (re-runnable, and so also the repair). Both come from
`python3 supabase/gen_apply.py`, which classifies by a marker the generators write.

For the expert, see [`supabase/functions/ai-expert/README.md`](supabase/functions/ai-expert/README.md).

## Publishing

A static site plus a Supabase project: see [`docs/publishing.md`](docs/publishing.md). The two
steps that are easy to miss are the route rewrite (already configured for Vercel, Netlify and
Cloudflare) and the Supabase **Site URL**, which is what the sign-in email points at.

Installable on a phone: `public/manifest.webmanifest` and the icons, which are drawn by
`scripts/gen_icons.py` rather than kept as binaries nobody can regenerate.

## Privacy and deletion

`/privacidad` says in plain words what is kept, what is public (your handle and the games you
publish — never your email), what the AI expert sends to Anthropic, and how to delete everything.

**Deleting an account really deletes it.** The `delete-account` edge function takes the user id
from the verified token, never from the request, and uses the service role — which no browser may
hold — to remove the account; everything personal cascades with it, and the app clears what it kept
on the device. Games the person published stay, without their name: those are rules other people
are using. `python3 supabase/verify_functions.py` proves the whole path on a throwaway account.

## Security

What the database enforces, with tests rather than hope:

- **Every table has row level security**, and 51 schema assertions check the rules that matter: an
  author cannot publish their own game, editing a published game forces re-review, a rejection
  needs a reason, only a reviewer writes the review log, sharing needs an accepted friendship, a
  group member cannot rewrite the membership, a message cannot be edited, and nobody sees anybody
  else's favourites, folders, inventory, matches, drafts or chat.
- **Only a reviewer writes `game_versions`**, which is the table the public catalogue reads. Write
  access to it *is* the power to publish, so an author has none: they cannot put a game on the
  shelf, and they cannot take one off it by hiding or editing their own copy. Asserted both ways.
- **A birth date is private to its owner.** It drives the 18+ gate and lives in `profile_settings`,
  never in the world-readable `profiles` row — asserted, including that the column is not there.
- **`profiles.role` is unwritable from a client** — column grants plus a trigger. Otherwise anyone
  could make themselves the owner. Promoting the owner is a SQL script, on purpose.
- **No email is reachable from the client.** `profiles` has no email column; searching is a
  database function that returns five fields, none of them an address. Searching people by email
  would answer "does this address have an account here?" for anybody who asked.
- **A content preference is private.** `hide_adult` moved out of the public profile row into
  `profile_settings`, readable only by its owner.
- **Counter triggers run `security definer`** — as the caller, RLS hid other people's rows *and*
  silently blocked the write, leaving every rating and favourite count at zero with no error.
- **No user text is interpolated into a query filter.** Deleting folders by name let a name with a
  quote in it change which rows matched; it deletes by uuid now.
- **The Anthropic key lives in the edge function**, which runs every query with the caller's own
  JWT, so it can read nothing the caller could not.
- **No `dangerouslySetInnerHTML` anywhere.** Rules bodies are a tiny Markdown subset rendered by
  hand (`src/components/Markdown.tsx`): paragraphs, lists and bold, nothing else.

## Still open

- **The expert is parked.** It is deployed and holds a key, but the Anthropic account has no credit,
  so every question would come back as an error nobody can act on. The screen says we are working on
  it, and `VITE_EXPERT_ENABLED=1` turns the whole feature back on with no code change.
  `python3 supabase/verify_functions.py --with-ai` is the command that will say whether it answers.
- **Password recovery needs SMTP.** The code is done and its errors are worded, but delivery goes
  through Supabase's built-in email service, which is capped at a few an hour and often does not
  deliver. Production needs a custom SMTP provider configured in the Supabase dashboard, and
  `/nueva-contrasena` added to the redirect allow-list.
- **English translations of the nine games.** The gap is now visible rather than silent: a reader
  with the app in English is told the rules are in Spanish instead of being handed them with no
  explanation. `game_texts` already takes a row per language, and `game_texts_translate` already
  lets any signed-in reader add a language a game does not have — so the next step is a screen for
  contributing one, not a schema change.
- Offline caching of favourited rules (a service worker), so a favourite is readable with no signal.
  The worker caches the shell and the assets today, not the rules.
