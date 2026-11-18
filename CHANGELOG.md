# Changelog

## 0.7.1 — 2026-11-18 — Delete account
- **Settings → Delete account:** type your e-mail, confirm, and everything is removed: files in all buckets, inspections, share links, the profile and the sign-in account. You're signed out and see a confirmation on the home page. Admins can't delete themselves.
- Migration `0008_account_deletion.sql`: payment records survive with `user_id = null`, and the stored Paymob callback (payer details) is wiped. The admin payment list still shows them.
- Fixed: Supabase's `deleteUser` alone fails with "Database error deleting user" once a user has data. The profile is now deleted first as service_role (D-015).
- Privacy policy updated to describe self-service deletion.
- Tests: DB test for the deletion cascade and anonymised payments; E2E test that creates a throwaway account with a stored PDF, deletes it from Settings, and checks the user, files and session are gone.

## 0.7.0 — 2026-11-18 — Stage 7: admin, share links, legal pages, security, E2E
- **Admin dashboard** (`/admin`, admins only, 404 for others):
  - Overview KPIs and 30-day charts.
  - Users: search, account type, grant, extend or end Pro.
  - Inspections: metadata only.
  - Plans editor, subscriptions and payments.
  - Checklist templates per room type.
  - Defect categories (EN/AR).
  - App settings: announcement banner, support contacts, AI daily limit.
  - Append-only activity log with diffs.
- **Report share links:** 7, 30 or 90 days, a branded public page, a download count, revoke at any time, and a 60-second signed download. Needs the service-role key.
- **Admin-managed defect categories** are used in the defect form, checklist, defect pages and PDF reports.
- **Announcement banner** on every app page, set in Admin → Settings.
- **Legal pages** (drafts, EN/AR): Privacy, Terms, Refund, plus a Contact page from Admin → Settings. They're linked from the landing footer and sign-up.
- **Security review** (`docs/security-review.md`):
  - Fixed an open redirect in the auth callback.
  - Report PDFs are now deleted with their inspection.
  - Added CSP and security headers.
  - Capped report generation at 30 per user per hour.
  - A DB test asserts RLS and pinned `search_path` everywhere.
- **Tests:**
  - 17 DB tests (5 new: admin guard, admin functions and audit, config tables, share links, security baseline).
  - 7 unit tests (3 new for the redirect guard).
  - Playwright E2E: 7 public checks on desktop and mobile, plus a signed-in journey that runs when `E2E_EMAIL`/`E2E_PASSWORD` are set.
- Migration `0007_admin.sql`. Decisions D-011 to D-014.

## 0.6.1 — 2026-11-18 — First production deployment
- Live on Vercel: https://snagit-delta.vercel.app (Hobby plan, functions in `dub1` next to Supabase `eu-west-1`).
- `vercel.json` (region), `.vercelignore` (no `.env*` uploads), `siteUrl()` falls back to the Vercel production domain.
- Checked on production: sign-in, dashboard, inspection pages, billing, and EN + AR PDF reports rendered by `@sparticuz/chromium` (pages inspected as images).
- README deployment steps rewritten for the CLI flow. Decision D-010.

## 0.6.0 — 2026-11-18 — Stage 6: plans, limits and Paymob payments
- Plans: Free (1 active inspection, 10 defects, PREVIEW report, view-only plan, no after photos), Pro annual EGP 2,499, single report EGP 399 that unlocks one inspection. Prices and limits live in the `plans` table.
- Limits enforced by database triggers (`SNAGIT_LIMIT:*`), surfaced as upgrade prompts with a link to Billing. Writes into other users' rows still fail on RLS first, so no information leaks.
- Paymob checkout (Intention API + Unified Checkout). The webhook verifies HMAC-SHA512 over the 20 documented fields, checks amount and currency, and is idempotent. It's the only place a payment becomes paid. No buy buttons without credentials.
- Free-plan reports carry a PREVIEW watermark on every page.
- Billing page, payment return page, landing pricing, dashboard plan chip, Settings plan card.
- Migration `0006_billing.sql`. Tests: 4 HMAC unit tests + 12 DB tests (incl. Free limits, unlock, Pro, expiry).
- Sample loader no longer leaves an orphan property when the plan limit refuses the inspection.

## 0.5.0 — 2026-11-18 — Stage 5: AI defect assistant (optional)
- "Analyze photos" and "Improve wording" in the new/edit defect form, using Claude Opus 5.5 vision with structured outputs and server-side refusal fallbacks.
- Suggestions are labelled preliminary, applied field by field with "Use", and only saved when the user saves the defect. Potentially serious visible issues are flagged with a specialist recommendation.
- Photos are resized to 1280 px in the browser before sending; stored photos are used for existing defects.
- Usage log `ai_requests` (migration 0005) with a per-user daily limit that fails closed; DB test added (11 tests).
- Hidden entirely when `ANTHROPIC_API_KEY` isn't configured. Not yet run against the live API (no key).

## 0.4.0 — 2026-11-18 — Stage 4: PDF reports
- New **Report** tab: generate an A4 PDF in English or Arabic (RTL) on the server with headless Chromium.
- Contents: cover, executive summary with overall assessment, floor plan with numbered pins, defect register with before/after photos side by side, room-by-room checklist, final remarks, outstanding defects, signatures, disclaimer, page numbers.
- Each report is a new immutable version in a private `reports` bucket with a frozen summary; earlier versions remain downloadable.
- Fonts and images are embedded; rendering blocks all network access from the report page.
- Migration `0004_reports.sql` and a DB test for report versions (10 tests).

## 0.3.0 — 2026-11-18 — Stage 3: interactive floor plan
- New **Floor plan** tab: zoom (wheel / pinch / buttons), pan, tap to add a defect at a spot or pin an existing one.
- Severity-coloured numbered markers that keep their size when zoomed. Marker card with Open / Move / Remove pin. Resolved defects are faded and can be hidden.
- PDF floor plans are rendered to PNG in the browser (pdf.js) so they can be pinned and later printed. The original stays downloadable.
- Upload or replace a plan from the plan tab. Old files are deleted from Storage.
- Room layout fallback when there's no plan: rooms coloured by worst open defect, with quick links.
- Defect page mini map with "View on plan" / "Pin on plan". New defects created from the plan return to it, focused on the new pin.
- Migration `0003_floor_plan_mapping.sql` and a DB test for pin rules (9 tests).

## 0.2.1 — 2026-11-18 — Fixes from the first test on a real Supabase project
- Google button only appears when Google is enabled in Supabase. The server action also refuses if it isn't, instead of landing on a raw JSON error.
- The Supabase URL is accepted even if pasted with `/rest/v1/` at the end.
- Default dates (defect "identified on", wizard, sample project) use Cairo time instead of the server's UTC.
- The Arabic UI uses Latin digits throughout, so dates and counts match unit numbers. The Arabic greeting uses an Arabic comma.
- Inspection pages have proper browser-tab titles.
- The defect form save bar is a solid card, no longer overlapping fields. Small files show their size in KB.
- README: email templates that make reset/confirm links work in any browser.

## 0.2.0 — 2026-11-17 — Stages 1 + 2

### Stage 1: auth, database, dashboard, property creation
- Supabase schema with RLS on all tables, private storage buckets and policies (`supabase/migrations/0001_init.sql`).
- Email/password and Google auth, password reset, profile and account type, sign out.
- Dashboard with KPIs, project cards and a sample-project loader.
- 4-step new-inspection wizard with floor-plan upload; rooms are generated from the unit's layout.
- Arabic RTL / English LTR with a language toggle; mobile bottom navigation.

### Stage 2: inspections, checklists, defects, photos
- Bilingual default checklist for 9 room types (`0002_checklist_templates.sql`).
- Room checklist: Passed / Failed / Not inspected, notes, custom items and categories, remove items.
- Failed item → defect with prefilled fields; automatic D-numbering.
- Defect form, list with filters and sorting, detail view, edit and delete.
- Before and after photos with in-browser resizing, before/after comparison, reinspection updates.
- Database tests on PGlite: triggers, numbering, summary view, RLS isolation, storage rules.
