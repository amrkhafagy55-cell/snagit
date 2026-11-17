# CLAUDE.md — SNAGIT

This folder is **SNAGIT**, a property inspection & snagging SaaS. The `CLAUDE.md` one level up (Desktop) describes a different product (Sekka). Ignore its product context, stack, sprint plan and "Where we are" here. Its communication rules still apply: talk to the user in Egyptian Arabic, keep technical terms in English, and write code, commits and docs in English.

@AGENTS.md

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run test:db`
- Run `npm run test:db` after any change under `supabase/migrations/`.

## Where things live
- `supabase/migrations/`: schema, RLS, storage policies, seed templates. Edit with care: production runs these in order.
- `src/lib/`: `auth.ts` (getUser / requireUser), `data.ts` (server loaders), `validation.ts` (zod), `types.ts`, `photos.ts` (client upload), `i18n/` (`en.ts` is the source of truth; `ar.ts` is typed against it).
- `src/app/(auth)`: auth pages and actions. `src/app/(app)`: signed-in app. `(app)/_actions/`: every mutation.
- `docs/decisions.md`: technical decisions. `README.md`: setup, schema, roadmap. `CHANGELOG.md`.

## Rules
- Every server action: validate with zod → `authed()` → RLS-scoped client. Never use the service-role key in user flows.
- New UI text goes into both `en.ts` and `ar.ts`. Use logical CSS (`ms-`/`me-`/`start-`/`end-`) and add `flip-rtl` to directional icons.
- No fake buttons: don't link to features that don't exist yet.
- Stages 1–4 are done. Next is Stage 5 (AI defect assistant). Roadmap is in the README.
- PDF reports: `src/lib/report/` (collect → html → render). Check a generated report by rendering its pages to PNG (pdf.js + @napi-rs/canvas in a scratch folder) and reading them; never trust layout from code alone.
- Constants used by server components must not live in a `"use client"` file: the server gets a reference proxy, not the value (see `components/plan/marker-colors.ts`).
