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
- Every server action: validate with zod → `authed()` → RLS-scoped client. The service-role key is allowed in exactly three places: Paymob checkout/webhook (`lib/payments`) and the share download route (`app/s/[token]/download`), each after the request is verified. Never in admin flows: admins act through RLS admin policies and `admin_*` SQL functions (D-011).
- New UI text goes into both `en.ts` and `ar.ts`. Use logical CSS (`ms-`/`me-`/`start-`/`end-`) and add `flip-rtl` to directional icons.
- No fake buttons: don't link to features that don't exist yet. Features that need a missing key are hidden, not disabled.
- All 7 stages are built. Live tests still need keys: AI (ANTHROPIC_API_KEY, migration 0005), Paymob (PAYMOB_* + SUPABASE_SERVICE_ROLE_KEY), share links (SUPABASE_SERVICE_ROLE_KEY, migration 0007). Backlog is in the README roadmap.
- Admin: `/admin` (layout 404s non-admins), actions in `(app)/_actions/admin.ts`, SQL in `0007_admin.sql`. Every new admin capability needs an `assert_admin()` check in SQL and an audit entry. Admins see metadata only for other users' inspections; keep it that way unless the product owner decides otherwise.
- Security: keep `docs/security-review.md` current. Redirect targets from user input go through `safeRedirectPath()`. New third-party origins must be added to the CSP in `next.config.ts`. `npm run test:db` asserts RLS on every table and pinned `search_path` on definer functions.
- Tests: `npm test` (unit + DB) must pass before a commit; `npm run test:e2e` before a deploy (signed-in journey needs `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local`; never print them).
- Production: https://snagit-delta.vercel.app (Vercel project `khafagy/snagit`, linked in `.vercel/`, no Git remote yet). Deploy with `npx vercel deploy --prod` from this folder; in the user's PowerShell use `npx.cmd`, since script execution is disabled there. Add env vars with `vercel env add`, piping values from `.env.local` and never printing them. See D-010.
- Billing: limits are DB triggers in `0006_billing.sql` (errors `SNAGIT_LIMIT:*` → `limit_*` codes in `_actions/common.ts`). Only `/api/payments/paymob/webhook` (HMAC-verified) may mark payments paid. Keep it that way.
- AI: `src/lib/ai/defect-assistant.ts` (model, prompt, schema) + `(app)/_actions/ai.ts` (limits, logging). Load the claude-api skill before changing either; keep the "preliminary, human-confirmed" contract.
- PDF reports: `src/lib/report/` (collect → html → render). Check a generated report by rendering its pages to PNG (pdf.js + @napi-rs/canvas in a scratch folder) and reading them; never trust layout from code alone.
- Constants used by server components must not live in a `"use client"` file: the server gets a reference proxy, not the value (see `components/plan/marker-colors.ts`).
