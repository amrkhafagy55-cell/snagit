# Security review — Stage 7 (2026-11-18)

Scope: the whole app at version 0.7.0 (Next.js server actions and routes, Supabase schema and RLS, storage, payments webhook, share links, admin panel, headers, dependencies). Method: code reading, DB tests on the real migrations (PGlite), Playwright checks against the running app, a production build with a client-bundle scan, and `npm audit`.

## Fixed in this review

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | **Open redirect in `/auth/callback`.** `next=/%09/evil.com` passed the `startsWith("/")` check; the URL parser strips the tab, so users were sent to `https://evil.com/` after confirming an e-mail or signing in with Google. | Medium | One helper, `src/lib/safe-redirect.ts`, used by the callback and the sign-in actions. It rejects `//`, backslashes, whitespace and control characters, then checks the resolved origin. Covered by unit tests (`tests/safe-redirect.test.mjs`) and an E2E check. |
| 2 | **Report PDFs stayed in Storage after deleting an inspection.** Rows cascaded, but the `reports` bucket files were not removed. That contradicts the privacy policy. | Medium | `deleteInspectionAction` now removes the report files too, as it already did for photos and plans. |
| 3 | **No security headers.** There was no CSP, no clickjacking protection, no HSTS, and the `X-Powered-By` header was sent. | Medium | `next.config.ts` adds CSP (`frame-ancestors 'none'`, `object-src 'none'`, connect, image and form targets limited to this site and the Supabase project), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`, and turns off `X-Powered-By`. Share pages also send `no-referrer` and `noindex`. Checked in the browser (no CSP violations on the plan, photo and report pages) and by E2E. |
| 4 | **Report generation could be triggered without limit.** Each report starts a headless Chromium, so a scripted loop could run up hosting costs. | Low | 30 reports per user per hour, then `rateLimited`. |

## Checked and fine

- **Isolation:** every `public` table has RLS (asserted by a DB test). Child rows carry `owner_id` and write policies check the parent's owner. Plan-limit triggers return early for rows the writer doesn't own, so they can't leak another user's counts.
- **Security-definer functions:** all of them pin `search_path` (asserted by a DB test). Admin functions start with `assert_admin()`, can't be called by `anon`, and write to an append-only `admin_audit` that only definer code can insert into.
- **Admin scope:** admins have RLS write access only to global config (plans, templates, categories, settings). The admin inspection list returns metadata, never defect text, photos or report paths. An admin can't change their own role, so there's no lock-out, and nobody can promote themselves.
- **Share links:**
  - Tokens are 64 hex characters (about 244 random bits, from two `gen_random_uuid()` calls).
  - Lookups run through `get_report_share` / `open_report_share`, which return nothing for unknown, revoked or expired tokens.
  - The token format is checked before any query.
  - Owners can revoke but not extend or un-revoke; this is enforced by a column grant and an RLS `with check`.
  - Validity is capped at 91 days by a constraint.
  - The service-role key is used only after the token resolves, to sign a 60-second URL for that one file.
- **Payments:**
  - Only the HMAC-SHA512-verified webhook marks payments paid, using a constant-time comparison. It also checks amount and currency, and it is idempotent.
  - The return page only reads.
  - Paymob and service-role keys are server-only.
- **Uploads:**
  - Storage enforces MIME types and size limits per bucket.
  - Storage policies keep every object under the uploader's `<user_id>/` folder.
  - Photos are re-encoded in the browser, which strips EXIF and GPS data.
- **Validation:** every server action validates input with zod and returns error codes, never raw database messages.
- **Secrets:**
  - `.env*` files are git-ignored and Vercel-ignored.
  - Production values live in Vercel env vars.
  - A scan of `.next/static` after `next build` finds no service-role, Paymob, Anthropic or HMAC identifiers.
- **Dependencies:**
  - `npm audit --omit=dev` reports 0 vulnerabilities.
  - The 14 "high" findings in the full audit are in dev-only lint tooling (`fast-glob` via `@next/eslint-plugin-next`) and don't ship.

## Accepted / open risks

| Risk | Why accepted / next step |
|---|---|
| CSP allows `'unsafe-inline'` scripts | Next.js inlines its bootstrap. Per-request nonces would need middleware changes and disable static optimisation. Revisit together with Cache Components (D-001). |
| `has_pro(uuid)` is callable by any signed-in user | It reveals only whether some user id is Pro, and ids are random UUIDs that are never shown. Triggers depend on it, so revoking it needs care. Backlog. |
| Supabase's built-in e-mail sender is rate-limited | Configure custom SMTP before launch (README, credentials table). |
| ~~No in-app account deletion~~ | **Done in 0.7.1:** Settings → Delete account. It removes files, data, the profile and the auth user, and keeps payments anonymised (D-015, E2E-tested). |
| Vercel Hobby plan | Not allowed for commercial use. Move to Pro before taking real payments (D-010). |
| Legal pages are drafts | They need a lawyer's review, the operator's legal name and address, and a decision on the refund windows. |
| No WAF or rate limiting on sign-in beyond Supabase's | Supabase Auth applies its own limits. Consider Vercel Firewall rules after launch if abuse shows up. |
