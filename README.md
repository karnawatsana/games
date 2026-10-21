# The Daily 3

Two favorites. One surprise. Better together.

A social home for daily brain games: **Krillion**, **Fermi**, and a rotating **Mystery** game. Play on the original sites, log your result (paste text, upload a Krillion screenshot, or quick entry), and see how your friend groups did.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS 4, Supabase (Postgres, Auth, Storage, RLS), Claude Vision for Krillion screenshots, Zod, Motion, Vitest.

## What is verified vs. not

| Area | Status |
|---|---|
| Krillion screenshot schema, validation (7 answers, sum = total, range, wrong player, duplicates) | Unit-tested against fixture values read from the real screenshot |
| **Live Claude Vision extraction** | Test exists (`tests/krillion.integration.test.ts`) and **only runs with `ANTHROPIC_API_KEY`**. Not yet run, so extraction accuracy is unproven |
| RLS policies (membership, join-date privacy, spoilers, invites, private screenshots) | Tested against the real migrations in an in-process Postgres (PGlite) |
| Leaderboards, streaks, timezone/DST, mystery selection, score direction, duplicate merging | Unit-tested |
| **Krillion share-text parser** | Conservative guess. The real format hasn't been verified, so it always asks you to confirm the score |
| **Fermi share-text parser** | **Not implemented against a real format.** It captures raw text and any `Nx` token for confirmation. Send a real Fermi share example to build and test a proper parser |
| Mystery pool | Candidates seeded **inactive and unverified** (`supabase/seed.sql`). Nothing is selectable until you verify and activate it |
| Supabase calls (auth, actions, pages) | Typechecked and built; **not exercised against a live project** yet |

## Setup

### 1. Supabase
1. Create a project at https://supabase.com.
2. In the SQL editor (or with the Supabase CLI), run in order: `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_storage.sql`, `0004_extraction_quota.sql`, then `supabase/seed.sql`.
   - CLI alternative: `supabase link --project-ref <ref> && supabase db push`.
3. Storage: `0003_storage.sql` creates two buckets: `result-screenshots` (**private**) and `avatars` (public read, per-user write). Confirm both exist under Storage.
4. Auth → URL configuration: set Site URL to your deployed URL and add `http://localhost:3000/auth/callback` and `<your-url>/auth/callback` to Redirect URLs.
5. Project Settings → API: copy the URL, `anon` key, and `service_role` key.

### 2. Anthropic
Create an API key at https://console.anthropic.com. Set a monthly spend limit there. Per-user quotas also apply (`EXTRACTIONS_PER_HOUR`, `EXTRACTIONS_PER_DAY`).

### 3. Environment
```bash
cp .env.example .env.local   # then fill in values in your editor; never paste keys into chat
npm install
npm run dev
```
`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server-only.

### 4. Activate mystery games
Before the rotation has anything to pick, verify at least one game against the checklist (free, mobile-friendly, daily/shared challenge, 2–10 min, stable URL, reliable completion/score submission, no required account or subscription), then:
```sql
update games set active = true, verified_at = now() where slug = 'timeguessr';
-- optional safe fallback used only if the pool is empty:
update games set is_fallback = true where slug = 'timeguessr';
-- or schedule a specific day:
insert into daily_game_schedule (game_date, mystery_game_id, source)
  select '2026-10-25', id, 'scheduled' from games where slug = 'timeguessr';
```
If nothing is eligible, the Mystery card shows "not scheduled yet" rather than a random URL.

## Tests
```bash
npm test            # unit + RLS tests (live vision test is skipped without a key)
ANTHROPIC_API_KEY=... npm test -- krillion.integration   # real Claude Vision call on tests/fixtures/krillion-screenshot.png
npm run typecheck
```

## Deploy (Vercel)
1. Push this repo to GitHub and import it at https://vercel.com/new.
2. Add every variable from `.env.example` in Project → Settings → Environment Variables (set `NEXT_PUBLIC_SITE_URL` to the production URL).
3. Deploy. Then update Supabase Auth URLs to the production domain.

## Design system
Tokens live in `app/globals.css` (`@theme` + CSS variables): charcoal `#202120`, cream `#F5F1E8`, lime `#D3ED77`, butter `#FFD16A`, coral `#F27B70`, mint `#B7EADD`, sky `#B8CEEF`, lavender `#A89CF0`. Inter for UI; Instrument Serif for editorial accents. Dev-only visual fixtures: `/preview`, `/preview/compare`, `/preview/submit` (404 in production).

## Architecture notes
- **One canonical result** per user/game/date (`game_results` unique key). Groups never copy results; visibility is computed by RLS (`can_view_result`): same group, and not older than the viewer's/owner's join date.
- **Spoilers:** Krillion answers are RLS-gated on "viewer has submitted Krillion for that date" and on the owner's `share_answers` setting. "Show anyway" is a server-side override restricted to results the viewer could already see.
- **Mystery:** one `daily_game_schedule` row per date (permanent history). Selection is deterministic, avoids repeats for 14 days, only uses verified+active games. Product timezone `America/New_York`.
- **Verification levels:** `verified` (parsed/validated), `user_confirmed` (manually marked), `unverified`. Native scores are never combined across games.
- **Privacy:** screenshots private per user folder; invite tokens stored only as SHA-256 hashes; account deletion removes data and stored files.
- **Not done:** third-party game account integrations (no official APIs confirmed), PWA/Web Share Target, advanced achievements.
