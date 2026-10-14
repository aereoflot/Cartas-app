# ai-expert

The card-games expert. Runs on Supabase Edge Functions so the Anthropic key stays on a server — a
key shipped to a browser is a key anybody can spend.

## Deploying

Two things that are not obvious on this machine, both learned the hard way:

- **Do not install the CLI globally with npm here.** The `npm` on the WSL `PATH` is the Windows
  one, so it installs into `/mnt/c/Users/.../AppData/Roaming/npm/` and writes a launcher that
  calls `node` — which does not exist on the WSL `PATH`. The install "succeeds" and every command
  then fails with `exec: node: not found`. Use `npx` with the Linux Node instead.
- **`--use-api` bundles server-side, so Docker is not needed.** Without it the CLI wants a Docker
  daemon, and there is none here.

```bash
export PATH="$HOME/.local/node/bin:$PATH"     # the Linux Node, not the Windows one
export SUPABASE_ACCESS_TOKEN=sbp_...          # https://supabase.com/dashboard/account/tokens

npx supabase@latest secrets set ANTHROPIC_API_KEY=sk-ant-... \
  --project-ref iqxiykqweqzsvyqahbsk
npx supabase@latest functions deploy ai-expert \
  --project-ref iqxiykqweqzsvyqahbsk --use-api
```

`--project-ref` means no `supabase link` and no `supabase login` are needed, which matters because
`login` wants a browser. The Anthropic key can also be set without the CLI, from the dashboard
under **Edge Functions → Secrets**, which is the better way if you would rather it never go
through a terminal history.

An Anthropic API key is a separate thing from anything Supabase: it comes from
`console.anthropic.com`, and API use is paid per request. The function keeps the cost small
(cached rules, low effort, 200 messages per person per month) but it is not free.

Until it is deployed and the secret is set, the app's expert screen says so instead of spinning:
the function answers `503 no-api-key` when the key is missing, and the client turns that into a
plain sentence.

## What it does, and what it may not do

| mode | source it is allowed to use |
|---|---|
| `explain` | the rules of one game, re-explained at a chosen register |
| `referee` | **only** those rules; it must say when they do not cover the situation |
| `suggest` | a list of games the function looks up itself, so it cannot recommend a game that does not exist |
| `author` | the author's own messy text, turned into the repo's section template |

Two of those constraints are the whole point. A referee that invents a rule is worse than no
referee, so the system prompt forbids it and asks it to name the section it is relying on. A
recommender that suggests games you do not have is useless, so the candidates are fetched from the
catalogue before the model is asked.

## Costs and limits

- `claude-opus-5-5`, adaptive thinking, `effort: low` for explaining and `medium` for refereeing.
- The rules text sits in a cached system prompt, so a run of questions about one game pays for it
  once.
- 200 messages per person per 30 days, counted from `ai_messages`. A cap nobody notices and a bill
  that cannot run away.
- Every exchange is recorded in `ai_threads` / `ai_messages` with its token counts, so the cost is
  attributable per person rather than a single mystery number at the end of the month.

## Security

- The caller's own JWT is passed through to a Supabase client, so every query the function makes
  runs under that person's row level security. It cannot read a draft, a private deck or anybody
  else's anything.
- It refuses without a signed-in user (`401`), and refuses a mode it does not know (`400`).
- The key is read from `ANTHROPIC_API_KEY` in the function's environment and never returned.
