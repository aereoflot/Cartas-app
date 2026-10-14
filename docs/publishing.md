# Publishing

The app is a static site plus a Supabase project. Nothing is rendered on a server, so hosting it is
a matter of uploading a folder — the only care needed is in two places: the routes and the sign-in
URLs.

## Before the first deploy

1. **Fill in the contact email** in the privacy page. Search for
   `pon aquí tu correo de contacto` in `src/i18n/es.json` (and the English one). A privacy notice
   with no way to reach anybody is not one.
2. **Decide the address.** Everything below needs it; `cartas.vercel.app` is fine to start.

## Vercel

```bash
npx vercel            # first run: links the project and asks a few questions
npx vercel --prod     # publishes
```

Or connect the GitHub repository at vercel.com and every push to `main` publishes itself.

Either way, set these two in **Settings → Environment Variables**, for Production *and* Preview:

| name | value |
|---|---|
| `VITE_SUPABASE_URL` | `https://iqxiykqweqzsvyqahbsk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the anon key from Supabase → Settings → API |

Both are public by design: they are compiled into the page and anybody can read them. They are not
the dangerous ones — the service-role key and the Anthropic key live on the server and are not in
this repository at all.

`vercel.json` already sends every path to `index.html`. Without that, reloading `/decks` or opening
a shared `/search?players=4` link would 404: the app owns its routes, not the server. The same is
set up for Netlify (`netlify.toml`) and Cloudflare Pages (`public/_redirects`).

## Then, in Supabase

**Authentication → URL Configuration** — this is the step that is easy to forget and breaks
sign-in in a way that looks like a bug:

- **Site URL**: the published address, e.g. `https://cartas.vercel.app`
- **Redirect URLs**: add that address *and* keep `http://localhost:5173` for development

The sign-in link in the email points at the Site URL. Until this is changed, every link sends
people to localhost, which works only on the machine that built it.

## Checking it worked

```bash
npm run check:remote                   # the queries the app makes, against the live project
python3 supabase/verify_functions.py   # the edge functions, on a throwaway account
python3 supabase/live_check.py         # the write paths and the privacy rules
```

Then, by hand, on a phone: open the address, add it to the home screen (the manifest and icons are
in `public/`), sign in, star a deck, and start a match. The match panel is the part that has to
work with the screen locked and no signal.

## The expert

Deployed separately from the site, and it needs Anthropic credit on top of a key — the Claude Pro
subscription is a different product and does not include API use. See
[`../supabase/functions/ai-expert/README.md`](../supabase/functions/ai-expert/README.md).

## What is still worth doing before telling strangers about it

- **A way to report a game** exists in the schema (`content_reports`) but has no screen yet. An
  open platform without one is a platform you have to moderate by inbox.
- **Rate limiting on sign-in emails.** Supabase's free tier sends few enough that this is
  self-limiting for now, but it is the first thing that gets abused.
- **Backups.** Supabase keeps daily backups on paid plans; on the free plan, the content that
  matters (decks and games) is in this repository and can be re-seeded, but people's accounts and
  matches cannot.
