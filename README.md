# VoiceInvoice

A voice-driven invoicing app for a single tradesperson. Dictate the work; the app
resolves the client, builds a reviewable invoice with deterministic totals, and
generates a downloadable PDF. See [VISION.md](VISION.md) for the full product vision.

**Stack:** React + Vite + TypeScript · Supabase (Postgres + Auth + Edge Functions) ·
Claude (via a Supabase Edge Function) for voice → structured invoice extraction.

## Local development

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173
```

Build a production bundle with `npm run build` (output in `dist/`).

### Environment variables (frontend)

| Variable                        | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key          |

These are public by design — Row Level Security protects the data. Real secrets
(the Supabase secret key, the Anthropic key) live only server-side.

## Backend

- **Database & Auth:** Supabase. Schema is versioned in `supabase/migrations/`.
- **Voice agent:** the `supabase/functions/parse-invoice` Edge Function calls Claude.
  It requires two function secrets (set in Supabase → Edge Functions → Secrets):
  - `ANTHROPIC_API_KEY` — required.
  - `ALLOWED_ORIGIN` — optional; the deployed frontend origin for CORS
    (e.g. `https://voice-invoice.pages.dev`). Defaults to `*`. The function is
    JWT-verified regardless.

## Deployment (Cloudflare Pages)

The frontend is a static build (`dist/`) served from Cloudflare Pages, deployed
automatically on every push to `main` via Git integration.

**One-time setup (in the Cloudflare dashboard):**

1. **Workers & Pages → Create → Pages → Connect to Git**, and pick the
   `cmillgit/voice-invoice` repo.
2. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - (Node version is pinned by `.nvmrc` to 22.)
3. **Environment variables** (Production + Preview): add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` with the same values as your local `.env`.
4. **Save and Deploy.** Cloudflare builds and serves the app at
   `https://<project>.pages.dev`. Subsequent pushes to `main` redeploy automatically;
   pull requests get preview URLs.

**After the first deploy:** set the `ALLOWED_ORIGIN` Edge Function secret to your
Pages URL to lock CORS to your domain, then redeploy the function.

Deployment is configured by [`wrangler.jsonc`](wrangler.jsonc) (Workers + Static
Assets). SPA routing falls back to `index.html` via its
`not_found_handling: single-page-application` setting.
