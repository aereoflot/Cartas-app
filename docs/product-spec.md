# Cartas — Product Spec

Working language note: in this repo **deck** = *mazo* / *baraja*. "Spanish deck" = *baraja
española*, "French deck" = *baraja francesa* (poker cards).

---

## 1. The problem

Finding how to play a card game online means reading a blog post that forgets to say how many
players it needs, assumes a 52-card deck you don't own, and never mentions that the game breaks if
a card is missing. Family variants exist nowhere. This app makes the *requirements* first-class and
lets anyone publish the games they actually play.

## 2. Domain concepts

### 2.1 Deck

A deck is a definition, not a physical object: suits, ranks, extra cards, total count.

Three kinds:

- **standard** — curated and seeded by us: Spanish 40, Spanish 48, French 52, French 54 (jokers),
  German 32, Tarot 78, Uno 108.
- **variant** — forked from a parent deck, with cards added or removed. "Spanish 40 without 2s and
  3s", "52 cards plus 4 jokers". Carries `parent_deck_id`.
- **custom** — invented from scratch. Arbitrary suits and ranks, so a user can define a deck of 60
  cards in 5 colours for their own game.

A deck's structure is stored as data (suits, ranks, extras), which lets the app render a real card
grid, compute the card count, and check a game's requirements against a user's inventory.

### 2.2 Game

The core entity. Split in two deliberately:

- **`games`** — the language-neutral *specification*: player count, decks required, duration,
  complexity, missing-card policy, extras needed, mechanics tags. This is what search filters on.
- **`game_texts`** — the *content*, one row per locale: title, tagline, summary and ordered rules
  sections. A game is authored in one locale (`primary_locale`) and may gain translations later,
  by the author or by anyone.

Splitting them means a Spanish-authored game is still findable by an English user filtering for
"4 players, one 52-card deck", and translations never fork the specification.

#### Required specification fields

| Field | Why it exists |
|---|---|
| `players_min` / `players_max` | The single most-used filter. |
| `players_best` | "Works 2–6, best at 4" — the thing blog posts never say. |
| `supports_teams`, `team_size` | Mus and tute are partner games; this changes who you invite. |
| decks required (`game_decks`) | Which deck, **how many copies**, which cards to remove first. |
| `deck_count_total` | Denormalised sum of copies, so "I only have one deck" is a cheap filter. |
| `missing_cards_policy` | `strict` / `tolerant` / `irrelevant` — see below. |
| `missing_cards_note` | Free text: "any missing card breaks the 40-card count in mus". |
| `duration_min` / `duration_max` | Minutes per round or per game. |
| `complexity` | 1–5, how hard to learn. |
| `age_min` | Kid-table filter. |
| `requires_extras` | chips, pen & paper, timer, a big table, a coin. |
| `mechanics` | trick-taking, shedding, betting, bluffing, matching, memory, solitaire, drinking. |
| `fork_of_id` | "Poker — my house rules" points at poker. Variants are first-class. |

#### Missing-cards policy

The user asked for this explicitly, and it is a genuine differentiator:

- **`strict`** — the deck must be complete. Counting and trick games (mus, tute, brisca) break.
- **`tolerant`** — playable with gaps; the app shows a note on how far you can go.
- **`irrelevant`** — the game doesn't care (most shedding or stacking games with a shortened deck).

Combined with a user's recorded missing cards (`user_decks.missing_cards`), the app can say: *this
game needs a complete Spanish 40 and your deck is missing 2 cards — pick something else.*

#### Rules format

`game_texts.sections` is an ordered JSON array of `{ heading, body }` where `body` is restricted
Markdown (paragraphs, lists, bold, tables — no raw HTML). Suggested section order, enforced softly
by the editor as a template rather than a hard schema:

1. Objective — 1–2 sentences.
2. Setup — deal, deck preparation, seating.
3. Card ranking / values.
4. Play — turn structure.
5. Scoring.
6. End of game.
7. Variants & house rules.
8. Table talk / etiquette (optional, matters for mus).

A structured array (not one Markdown blob) is what lets the AI referee cite *which section*
answers a question, and lets the UI offer "just the setup" at a table.

### 2.3 User, friends, sharing

- **Profile**: username, display name, avatar, bio, locale.
- **Inventory** (`user_decks`): which decks the user physically owns, how many copies, which cards
  are missing. Powers the best feature in the app — *"what can we play right now"*.
- **Friendship**: request → accept, symmetric once accepted, blockable.
- **Share**: a game sent to a friend with an optional message, landing in their inbox on the home
  screen. This is the "open media system" — sharing a game, not posting photos.
- **Comments and ratings** on games, 1–5 stars, one rating per user per game.
- **Reports**: any user can report a game, deck or comment. An open upload platform needs this from
  day one, not as an afterthought.

### 2.4 Match

A **match** is one session of actually playing a game, started from the game's page by saying who is
at the table and which deck is being used. It opens the match panel (§3.7) and is the app's only
write-path into play history — which, for free, gives the suggestion engine real signal ("you play
4-player trick games on Sundays") and the user a list of what they have played.

A match belongs to the one person who started it, on one device. It is a scorer's companion, not a
synced multiplayer table — nobody else needs the app installed, which is exactly how a card table
works. Syncing a match across the players' phones is a v2 question.

Because it is used mid-game, at a table, possibly with no signal: **the match panel works fully
offline.** State lives in local storage first and syncs to Postgres when a connection exists.

## 3. Screens

```
/                     Home (main menu)
/search               Discover + filters
/games/:slug          Game detail
/games/new            Game editor (auth)
/games/:slug/edit     Game editor (author)
/games/:slug/play     Start a match (player count + deck)
/matches/:id          Match panel — the in-play companion
/matches              My play history
/decks                Deck library
/decks/:slug          Deck detail (card grid)
/decks/new            Deck builder (auth)
/friends              Friends list + requests + share inbox
/me                   Profile: my games, my decks, inventory, favorites
/ai                   AI card expert
/admin/review         Review queue (owner only)
/login                Auth
```

### 3.1 Home — the main menu

Six blocks, in this order, each a horizontal row or card grid:

1. **Resume** — any match left unfinished, shown with the game name and how long ago it started.
   One tap back into the panel. Only appears when there is one, and it sits above everything
   because someone mid-game reopening the app wants exactly this.
2. **Inbox** — games friends shared with you, unread first.
3. **Favorite games** — pinned, works offline.
4. **Favorite decks** — including the ones you built; tapping one shows "games for this deck".
5. **Play now** — a prompt: *how many are you?* → results filtered by player count ∩ your
   inventory. One tap from opening the app to a game you can actually play.
6. **Ask the expert** — entry to the AI section with three suggested prompts.

Plus a persistent search entry and a friends avatar strip.

### 3.2 Search & filters

Filters, all combinable, all reflected in the URL so a filtered search is shareable:

- number of players (a single number that must fall within `[players_min, players_max]`)
- deck type required (multi-select) and **number of decks needed**
- "only games I can play with the decks I own" (requires auth)
- "my deck is incomplete" → excludes `strict` games
- duration (≤15, 15–30, 30–60, 60+ minutes)
- complexity 1–5, minimum age
- mechanics tags, teams only, no extras needed
- language of available rules, rating, newest / most played

Results show a compact card: title, player range, deck chips, duration, complexity dots, rating.

### 3.3 Game detail

- Header: title, tagline, author, rating, favorite and share buttons.
- **Requirements strip** — the first thing visible: players, decks (with "you own this ✓" when
  signed in), duration, extras, missing-card policy badge.
- Rules by section, each collapsible.
- A primary **Play** button — the main action on the page. It asks for player count and deck, then
  opens the match panel (§3.7).
- For `adult_only` games, an advisory interstitial before the rules (§3.9).
- Variants: forks of this game, and the game it was forked from.
- Two AI buttons inline: **Explain differently** and **Ask about a situation**.
- Comments.
- Offline: favoriting a game caches its rules text for offline reading.

### 3.4 Deck builder

Fork an existing deck or start empty. Edit suits (name, symbol, colour) and ranks (label, sort
value), add extras (jokers, trumps). Live card-count readout and a preview grid. Save as private or
publish. Decks are reusable across games, so a published custom deck lets other authors target it.

### 3.5 Game editor

A form that mirrors §2.2 — specification first (it is quick, and it is what makes the game
findable), then rules sections with the §2.2 template pre-filled as empty headings. Saves as a
draft; submitting validates that the spec fields and at least Objective, Setup and Play are filled.
An **Import with AI** button turns pasted messy text ("how my grandmother played chinchón") into a
filled draft the author then corrects — the author always reviews before submitting.

Two checkboxes gate the submit button, both required:

- **Original wording.** "I wrote these rules myself and did not copy the text from another site or
  book." Rules themselves cannot be copyrighted; the *wording* can. The editor also shows a short
  note explaining the difference, so an author knows they may describe mus freely but must not
  paste someone else's paragraphs.
- **Adult content.** "This game involves drinking, betting with money, or adult themes (18+)."
  Sets `adult_only`, which drives the advisory in §3.9. Optional to tick, but the review step
  (§3.8) will tick it if the author forgot.

The button says **Submit for review**, not Publish — see §3.8.

### 3.6 AI card expert

Four modes, one chat surface:

- **Explain** — re-explain a specific game at a chosen register: for a 7-year-old, in 60 seconds,
  by walking through one sample hand, or as a comparison to a game the user knows.
- **Referee** — "we played a trick and both threw a 7, what now?" Answered strictly from that
  game's rules text, and it says plainly when the rules don't cover the case instead of inventing
  one. Grounding is non-negotiable here: the rules text is the authority, not the model's memory.
- **Suggest** — given player count, available decks, minutes and mood, recommends games from the
  catalogue, each with one line of reasoning. Candidates come from a SQL pre-filter; the model
  ranks and explains, so it can never recommend a game that doesn't exist.
- **Author assist** — messy text → structured draft (see §3.5).

Built, and waiting only on deployment: the function is in `supabase/functions/ai-expert/`, the
screen is `/ai`, and until `supabase functions deploy ai-expert` has run with an Anthropic key the
screen says exactly that and which command to run.

Implementation constraints:

- Supabase Edge Function `ai-expert`; the Anthropic key stays server-side.
- Model `claude-opus-5-5`, adaptive thinking, `output_config.effort` set explicitly (its default is
  `medium`), streamed back to the client over SSE.
- The game's rules text goes in a cached prompt prefix, so a multi-question referee session over
  one game is cheap after the first call.
- Per-user rate limit and a monthly token budget, enforced in the function.
- Every answer carries a visible "AI, may be wrong — the rules text wins" note, and referee answers
  link the section they came from.

### 3.7 Match panel — the in-play companion

The screen the app is actually *used* on: open on the table, mid-game, one device, possibly offline.
Started from a game page with player count and deck; everything in it is one tap from the others.

Top bar, deliberately minimal — nothing else competes with it:

```
┌──────────────────────────────────────────────┐
│  Chinchón                            24:17   │  ← game name · total match timer
├──────────────────────────────────────────────┤
│                                              │
│   [ active tool fills the panel ]            │
│                                              │
├──────────────────────────────────────────────┤
│  Notes   Calc   Timer   Rules   Referee      │  ← one tap each, state preserved
└──────────────────────────────────────────────┘
```

The match timer starts with the match and runs until the match is ended. It is text, not a widget:
no ring, no colour, no animation. Nothing on this screen should pull the eye away from the table.

The five tools, each keeping its state when you switch away and come back:

1. **Notes** — a plain, always-saved scratchpad. Autosaves on every keystroke to local storage.
   This is where scores end up for most games, so the keyboard must not cover the text.
2. **Calculator** — a simple arithmetic keypad with a visible running tape, because adding up
   chinchón points means a column of numbers, not one sum. Tape entries can be labelled with a
   player's name when the match has names.
3. **Timer** — a *second*, independent timer for a round, a turn, or a thinking limit. Start,
   pause, reset, and an optional countdown with a soft sound. Separate from the match timer above.
4. **Rules** — the game's rules sections, jump-to-section list at the top, cached offline. This is
   the most-used tool: the whole point is settling a question without leaving the match.
5. **Referee** — the AI mode from §3.6, pre-loaded with this game's rules. The only tool that needs
   a connection; offline it shows the Rules tool instead with an honest note why.

Ending a match asks nothing more than "done" — duration, player count and deck are already known,
notes are already saved. A match can also simply be abandoned; it stays unfinished in history
rather than nagging.

### 3.7b What are we playing for

An optional line on a match: *una cerveza*, *el café*, *pagar la cena*, *fregar los platos*. Free
text in the players' own words, never an amount — money owed is not something this app should
model, and "the washing up" is a more common stake than euros anyway.

- It is the **last** field when starting a match, and optional. People agree the prize while
  shuffling; it must never stand between opening the app and playing.
- Four suggestions as one-tap chips, and anything typed is accepted.
- Shown under the game name for the whole match, and kept in the history — the point of writing it
  down is that nobody gets forgetful afterwards.
- Lives on the match, not the game: the same game is played for nothing on Tuesday and for dinner
  on Saturday.

### 3.7c Challenging a friend

From the friends screen: pick a game, name the players, agree the stake, and the match panel opens.
This half needs no account and works offline, which covers the common case — everyone is at the
same table and one phone keeps score.

Sending a challenge to a friend's *own* phone, and the inbox of games friends share with you, need
accounts on both sides; that is M6, and the screen says so rather than showing a dead button. The
"shared with you" block has been taken off the home screen until then: an empty box promising
something that does not exist is worse than no box.

### 3.8 Review queue — every game is approved before it is public

Decided: nothing reaches the public catalogue unapproved. The flow:

```
draft ──submit──> pending_review ──approve──> published
                        │
                        └──reject(reason)──> rejected ──edit──> pending_review
```

- An author's own drafts, pending and rejected games are always visible to them, with the
  rejection reason shown inline so they can fix and resubmit.
- **In-app**: `/admin/review`, visible only to the owner account (`profiles.role = 'owner'`). A
  queue of pending games, oldest first, each showing the full spec and rules as the public page
  would render them, with Approve, Reject (with a reason), and Edit-then-approve for small fixes
  like a missing 18+ flag or a typo'd player count.
- **By email**: a new submission emails the owner the game's spec and rules plus two one-click
  links, **Approve** and **Reject**. Each link carries a signed, single-use, expiring token
  (HMAC over game id + decision + expiry, verified by the `review-action` edge function), so
  approval works from a phone with no login. Reject from email asks for a reason on the landing
  page. Tokens are invalidated once the game leaves `pending_review`, so a stale email cannot
  re-approve a game that was later edited.
- **Editing a published game returns it to the queue.** There is no way to quietly change a live
  game: saving an edit sets it back to `pending_review` and it leaves the public catalogue until
  approved again. The editor warns before saving, and offers "save as a variant instead" for an
  author who only wants to record a different way to play. Keeping the approved version public
  while an edit waits needs game versioning — a v2 feature.
- Rejections and approvals are logged in `game_reviews` — who, when, what reason — so an author
  cannot be told different things twice, and the queue has a history.
- A second moderator can be added later by giving another profile `role = 'moderator'`; the
  permission checks already allow for it, and no code assumes a single reviewer.

This is the one bottleneck in the product: every published game waits on one person. Two things
keep it from hurting — the queue shows the game exactly as readers will see it (so a review is a
read, not an investigation), and approving from email means it can be done in the time it takes to
read a message.

### 3.9 Adult-content advisory

No age verification, no date of birth, no account gate — decided, and right: asking a birthday
proves nothing and costs every user a form.

Instead, a game flagged `adult_only` (§3.5) shows a full-screen advisory before its rules, the
first time that device opens any 18+ game:

> **For adults — 18+**
> This game involves alcohol. If you are under 18, do not drink. Know your limit, drink water,
> and never drive after drinking.
> *[ I understand ]   [ Go back ]*

- Acknowledgement is remembered per device, not per game, so it appears once rather than nagging.
- A profile setting, **Hide 18+ games**, removes them from search and home entirely. Off by
  default for signed-out users, and the advisory still appears.
- 18+ games carry a small badge in every list, so nobody opens one by surprise.
- The advisory copy lives in the i18n files (`es` and `en`), not in the component — the wording
  will be revised and must not need a code change.

## 4. Internationalisation

- UI strings via i18next; `es` is the default and fallback, `en` complete at launch.
- Content is per-locale rows in `game_texts`, with `is_machine_translated` flagged so a human
  translation always wins and users know what they are reading.
- Locale affects search: by default show games with rules in the user's locale, with a toggle for
  "any language".
- Deck and suit names are localised on standard decks (`oros`/`coins`); user-authored decks store a
  single name plus optional translations.

## 5. Non-goals for v1

Not building: real-time online play of the games themselves, a match panel synced live across the
players' phones (v1 is one device, one scorer — §2.4), video, chat rooms, monetisation, a
recommendation ML model (the AI suggest mode covers it), age verification (§3.9), or iOS/Android
native builds (the PWA wrapper comes later).

## 6. Decisions on record

Settled with the owner on 2026-10-14:

1. **Moderation — review before publish.** Every submitted game waits in `pending_review` until the
   owner account approves it, either in `/admin/review` or by a one-click signed link in the
   notification email. §3.8.
2. **Adult games — advisory, not age control.** The author flags a game 18+; readers get a
   full-screen warning the first time, no birthday asked, plus a "hide 18+ games" setting. §3.9.
3. **Copyright — attested at submit.** The editor requires the author to confirm the wording is
   their own, and explains that rules are free to describe but text is not free to copy. §3.5.
4. **Deck inventory — one tap on the deck.** Marking a deck as yours is a button on the deck card,
   not a screen of its own, and it feeds the *only games I can play* filter. That filter runs on
   the device: the question gets asked at a table, often with no signal.
5. **The hide-18+ setting is private.** Its own table, readable only by its owner, because what
   somebody chooses not to see is not a public fact.
6. **Sign-in — a link by email.** Passwordless: no password to forget or leak, and one fewer
   field on the form. Google sign-in can be added later without changing anything else. The owner
   account is promoted with a SQL script, never from the app, because `profiles.role` is the one
   column a client must never write.
7. **Play logging — as the match panel.** Rather than a bare history table, play is logged by the
   tool people actually want at the table: a match panel with notes, calculator, round timer, the
   rules and the AI referee, under a minimal bar showing the game name and the total match timer.
   Works offline. §2.4, §3.7.
