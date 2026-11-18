# SNAGIT — Property Inspection & Snagging

SNAGIT helps apartment buyers, owners, inspectors and civil engineers inspect newly delivered units room by room, record construction defects with photos, and track each defect until it is fixed. Arabic (RTL) and English.

**Status:** all 7 stages are built (see [Roadmap](#roadmap)). Three parts can't run end to end until you add external credentials: the AI assistant (needs an Anthropic API key), Paymob checkout (needs Paymob keys) and report share links (need the Supabase service-role key, which Paymob needs too). See [Features that need external credentials](#features-that-need-external-credentials).

**Live:** https://snagit-delta.vercel.app (Vercel, see [Deployment](#deployment-vercel)).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, Server Actions, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS 4, lucide-react icons, Inter + IBM Plex Sans Arabic |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |
| Validation | zod (server side, every action) |
| Tests | Node test runner + PGlite (real Postgres in-process) for schema and RLS; Playwright (installed Chrome) for end-to-end |
| Hosting | Vercel (functions in `dub1`), Supabase in `eu-west-1` |

## What works today (Stages 1–7)

- **Auth:** email + password sign-up and sign-in, Google sign-in (once enabled in Supabase), password reset by e-mail, change password, sign out. Account types: *Individual* and *Professional Inspector*. *Administrator* can only be granted in SQL.
- **Profile settings:** name, phone, company, account type, language.
- **Dashboard:** totals (projects, active, completed, defects, critical + high), recently updated project cards with location, date, defect count, completion % and status. Empty state includes **Load sample project**, which creates a realistic 3-bedroom unit in 6th of October City with 8 defects.
- **New inspection wizard (4 steps):** project, unit, inspection, floor plan. Floor-plan upload accepts PDF, PNG or JPG up to 15 MB. Rooms are generated from the bedroom, bathroom and balcony counts.
- **Inspection workspace:** progress (passed / failed / not inspected), rooms grid with per-room progress and open defects, add or delete rooms, defects by severity, floor-plan preview, property details, general remarks (auto-saved), mark completed / reopen, delete inspection (removes its files too).
- **Room checklist:** bilingual default items per room type (architectural, electrical, plumbing, mechanical). Each item can be marked Passed, Failed or Not inspected, take notes, or be removed. Users can add custom items and custom categories. A failed item becomes a defect in one tap, with the title, room, category and notes prefilled.
- **Defects:** title, description, category, room, exact spot, severity (Critical / High / Medium / Low), status (Open, Under correction, Pending reinspection, Resolved, Rejected), recommended action, date identified, responsible party. Defects are numbered D-1, D-2… automatically. The defect list can be filtered by severity, status and room, and sorted.
- **Photos:** several before photos when registering a defect, and before or after photos added later. Photos are resized in the browser (max 2048 px JPEG, which also strips EXIF/GPS data) and shown side by side for before/after comparison.
- **Reinspection:** update the status, correction date and reinspection notes for each defect.
- **Floor plan (Stage 3):** a Floor plan tab per inspection. Zoom with the mouse wheel, a two-finger pinch or the +/− buttons, and drag to pan. Tap the plan to create a new defect at that spot, or to pin an existing one there. Markers show the defect number in its severity colour (red critical, orange high, yellow medium, blue low) and keep the same size at any zoom. Tapping a marker opens a card with Open / Move / Remove pin. Resolved defects are faded with a check mark and can be hidden. A "Not on the plan yet" list lets you pin defects one by one. PDF plans are rendered to an image (page 1) in the browser on upload, and the original PDF stays downloadable. The plan can be replaced, and pins keep their relative position. Each defect page shows a mini map of its location with "View on plan" / "Pin on plan". Without a plan, a **room layout** shows every room coloured by its worst open defect, with shortcuts to the checklist and "add defect".
- **PDF reports (Stage 4):** a Report tab generates a real A4 PDF on the server (headless Chromium) in English or Arabic, with full RTL and correct Arabic shaping. It contains a cover page (logo, project, unit details, inspector, overall assessment, KPIs), an executive summary (severity and room breakdowns, checklist completion), the floor plan with numbered, severity-coloured defect locations, a defect register (description, location, responsible party, recommended action, reinspection notes, before/after photos side by side), room-by-room checklist results, final remarks (observations, recommendations, outstanding defects), signature boxes for inspector and owner, a disclaimer, and page numbers. Every generation is a **new version** stored privately; earlier versions stay downloadable.
- **AI defect assistant (Stage 5, optional):** in the new/edit defect form, **Analyze photos** (vision) and **Improve wording** return a structured suggestion: title, category, severity with a reason, description, recommended action, possible causes, potentially serious visible issues and checks to do on site. It's always labelled *preliminary*: each field has its own **Use** button, and nothing is saved until the user saves the defect. The prompt forbids claiming a photo proves structural safety or a definitive cause. It runs on `claude-opus-5-5` (structured outputs, `fallbacks: "default"` for safety-classifier declines), server-side only. Every call is logged in `ai_requests`, with a per-user daily limit (`AI_DAILY_LIMIT`, default 30) that fails closed. The assistant is hidden when `ANTHROPIC_API_KEY` isn't set.
- **Plans & payments (Stage 6):** **Free** (1 active inspection, 10 defects per inspection, watermarked PREVIEW report, floor plan view-only, no after-correction photos), **Pro annual** (EGP 2,499) and **Single report** (EGP 399, unlocks that whole inspection). Prices and limits live in the `plans` table. Limits are enforced by **database triggers** (`SNAGIT_LIMIT:*` errors become upgrade prompts in the UI), so they can't be bypassed through the API. Checkout uses **Paymob** (Intention API + hosted Unified Checkout). Only the **HMAC-SHA512-verified webhook** marks a payment paid, after checking the amount and currency, and it's idempotent. The return page only reads status. Without Paymob keys, prices are shown but there are no buy buttons. Billing page, payment history, landing-page pricing, a dashboard plan chip and Settings plan card are included.
- **Admin dashboard (Stage 7):** `/admin`, visible only to administrators (everyone else gets a 404, and the database refuses them too).
  - **Overview:** users, Pro subscriptions, inspections, defects, reports, revenue, payments, unlocks, AI requests and active share links, plus 30-day daily charts of new users, inspections and reports.
  - **Users:** search, change account type (not your own), grant Pro until a date, extend it, or end it.
  - **Inspections:** metadata only (project, owner email, status, defect and report counts). Admins can't open defect details, photos or reports.
  - **Plans & billing:** edit names, prices, limits and whether a plan is offered; see subscriptions and payments with a status filter.
  - **Checklists:** add, edit, reorder or hide default checklist items per room type. Changes apply to rooms created afterwards.
  - **Categories:** add defect categories with Arabic and English names, rename, reorder or hide them. The defect form, checklist and reports use them.
  - **Settings:** an announcement banner (EN/AR) shown on every app page, the support email and WhatsApp number shown on the Contact page, and the AI daily limit.
  - **Activity:** an append-only audit log of every admin change, including field-by-field diffs of config edits.
- **Report share links (Stage 7):** from the Report tab, share one report version through a link valid for 7, 30 or 90 days. Recipients get a branded page with a Download button, with no account needed. Owners see each active link's download count and can revoke it at any time. Tokens are 64 hex characters, links never leak through the Referer header, and downloads go through a 60-second signed URL. Needs `SUPABASE_SERVICE_ROLE_KEY` on the server; without it the Share button is hidden.
- **Legal pages (Stage 7, drafts):** Privacy policy, Terms of use, Refund policy (EN/AR) and a Contact page, linked from the landing footer and the sign-up form. They're marked as drafts pending legal review.
- **Security:**
  - RLS on every table means a user only ever reads or writes their own rows. A DB test fails if any table loses RLS or any security-definer function has no pinned `search_path`.
  - Storage buckets are private and every file sits under `<user_id>/…`, enforced by storage policies. MIME types and size limits are enforced by Storage itself. Photos are served through signed URLs that expire after 1 hour.
  - The browser only ever gets the anon key; a build-time scan finds no server secret in client bundles.
  - Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are set, and redirects after sign-in are restricted to same-site paths.
  - See `docs/security-review.md`.
- **UX:** mobile-first layout with a bottom nav on phones, full RTL, loading skeletons, empty states, an error boundary and a 404 page.

## Setup

### 1. Supabase project
1. Create a project at [supabase.com](https://supabase.com). The free tier is fine.
2. In **SQL Editor**, run these files in order:
   - `supabase/migrations/0001_init.sql`: tables, enums, triggers, the RLS policies, private storage buckets.
   - `supabase/migrations/0002_checklist_templates.sql`: default bilingual checklist.
   - `supabase/migrations/0003_floor_plan_mapping.sql`: floor-plan image columns and the pin constraint (Stage 3).
   - `supabase/migrations/0004_reports.sql`: report version summaries and immutable report rows (Stage 4).
   - `supabase/migrations/0005_ai_requests.sql`: AI usage log for the daily limit (Stage 5; the assistant refuses to run without it).
   - `supabase/migrations/0006_billing.sql`: plans, payments, subscriptions, per-inspection unlocks and Free-plan limit triggers (Stage 6).
   - `supabase/migrations/0007_admin.sql`: admin functions and audit log, defect categories, app settings, report share links (Stage 7). Needs 0005 first.
3. Under **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (your production URL later)
   - Redirect URLs: `http://localhost:3000/auth/callback` (plus the production equivalent)
4. **Email templates** (recommended, so reset links also work when opened in a different browser or the mail app): under **Authentication → Emails**, change the link in **Reset password** to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   and in **Confirm signup** to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/dashboard`.
   Without this, Supabase's default links only work in the browser that requested them.
5. *(Optional)* Google sign-in: **Authentication → Providers → Google**. Add an OAuth client from Google Cloud Console. Its authorised redirect URI is the one Supabase shows.
6. *(Optional)* To skip e-mail confirmation while developing: **Authentication → Providers → Email → Confirm email** off.

### 2. Run locally
```bash
npm install
cp .env.example .env.local   # then fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```
Without the env values the app still starts and shows a "Connect Supabase" screen.

### 3. Make yourself an admin (once, in SQL)
```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```
After that, the **Admin** link appears in the navigation. Other admins and manual Pro grants are managed in **Admin → Users**; every change lands in **Admin → Activity**.

### 4. End-to-end tests (optional)
Create a dedicated test account (not an admin, Free plan, confirmed e-mail) and add it to `.env.local`:
```
E2E_EMAIL=e2e+snagit@example.com
E2E_PASSWORD=...
```
`npm run test:e2e` starts (or reuses) the dev server and runs in your installed Google Chrome. The public tests run on desktop and a mobile viewport. The signed-in test creates an inspection, adds a defect, generates a report, shares and revokes a link, then deletes everything it created. Without the two values it is skipped. Set `E2E_BASE_URL` to test a deployed site.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, runs `tsc` |
| `npm test` | Unit tests (Paymob HMAC, redirect guard) + database tests |
| `npm run test:db` | Runs all migrations on in-process Postgres and checks the triggers, numbering, limits, RLS isolation, storage rules, admin functions, share links and the security baseline |
| `npm run test:e2e` | Playwright end-to-end tests in the installed Chrome (see Setup step 4) |

## Deployment (Vercel)
`vercel.json` pins functions to `dub1` (Dublin), next to the Supabase project in `eu-west-1`. If your Supabase project is in another region, change it to the closest [Vercel region](https://vercel.com/docs/regions). `.vercelignore` keeps `.env*` files out of CLI uploads.

From this folder (on Windows PowerShell use `npx.cmd`):
1. `npx vercel login`, then `npx vercel link --project snagit`.
2. Add the two public values (Production and Preview):
   `npx vercel env add NEXT_PUBLIC_SUPABASE_URL --environment production,preview`
   `npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY --environment production,preview`
   `NEXT_PUBLIC_SITE_URL` is optional on Vercel: without it, auth e-mails and payment redirects use the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`), which follows a custom domain once you add one.
   Server-only keys (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `PAYMOB_*`) go in the same way with `--sensitive`, never with a `NEXT_PUBLIC_` prefix.
3. `npx vercel deploy --prod`.
4. In Supabase → Authentication → URL Configuration, set the Site URL to the production URL and add `https://<your-domain>/auth/callback` to Redirect URLs. Keep `http://localhost:3000/auth/callback` there for local development.
5. Paymob (when enabled): set the transaction callback to `https://<your-domain>/api/payments/paymob/webhook`.

PDF reports run `@sparticuz/chromium` in the function (about 1 GB of memory, 60 s max on the report page). No other server is needed: everything else is Supabase.

**Plan note:** Vercel's Hobby plan is for non-commercial use. Move to Pro (or another host) before taking real payments.

Any Node 20+ host that runs `next start` works too (it needs a Chrome/Chromium for reports, or `CHROME_EXECUTABLE_PATH`).

## Database schema

```
auth.users ─1:1─ profiles (role, locale)
profiles ─1:n─ properties ─1:n─ inspections ─┬─1:n─ rooms ─1:n─ checklist_items
                                             ├─1:n─ defects ─1:n─ defect_photos (before/after)
                                             └─1:n─ reports (Stage 4, versioned)
checklist_templates (global, admin-managed) → copied into checklist_items when a room is created
view inspection_summaries (security_invoker) → dashboard and workspace counts
plans · payments · subscriptions · inspection_unlocks (Stage 6)
reports ─1:n─ report_shares (Stage 7: token, expiry, revoke, download count)
defect_categories · app_settings · admin_audit (Stage 7, admin-managed)
```
- Every child table has an `owner_id` (default `auth.uid()`), so each RLS check is a single comparison. Write policies also check that the parent row belongs to the same user.
- `defects.number` is assigned per inspection by a trigger, with an advisory lock so concurrent inserts can't collide.
- `defects.plan_x` and `plan_y` hold the marker position as a fraction (0–1) of the plan image, so pins survive any display size or a higher-resolution replacement plan. Both are set or both are null.
- `properties.floor_plan_image_path` (+ width/height) is the image shown and pinned. For a PDF upload it's page 1 rendered to PNG; for an image it's the original file.
- Storage buckets: `floor-plans` (15 MB; PDF, PNG, JPG, WebP), `defect-photos` (10 MB; JPG, PNG, WebP), `reports` (Stage 4). All are private.

## Features that need external credentials

| Feature | Needs | Stage |
|---|---|---|
| Everything in the app | Supabase URL + anon key | 1 |
| PDF reports | Nothing extra locally (uses the installed Chrome/Edge, or `CHROME_EXECUTABLE_PATH`). On Vercel, `@sparticuz/chromium` is used automatically; give the function ≥1 GB memory | 4 |
| Google sign-in | Google OAuth client set up in Supabase | 1 |
| Production e-mails (confirm, reset) | Custom SMTP in Supabase (the built-in sender is rate-limited) | 1 |
| AI defect assistant | `ANTHROPIC_API_KEY` from console.anthropic.com (server-only, prepaid credits; roughly $0.03–0.05 per analysis of 1–3 photos), plus migration 0005 | 5 |
| Subscriptions / pay-per-report | Paymob account: `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_IDS` (test keys first), plus `SUPABASE_SERVICE_ROLE_KEY`. Set the Paymob transaction callback to `<SITE_URL>/api/payments/paymob/webhook`; Paymob can't reach localhost, so use a public URL or a tunnel when testing | 6 |
| Report share links | `SUPABASE_SERVICE_ROLE_KEY` (server-only), plus migration 0007 | 7 |
| Contact page details | Support email / WhatsApp set in **Admin → Settings** | 7 |
| Legal pages | Review by a lawyer, the operator's legal name and address, and a decision on the refund windows | 7 |

## Roadmap

| Stage | Scope | Status |
|---|---|---|
| 1 | Auth, database, dashboard, property creation | Done |
| 2 | Room inspections, checklists, defects, photo uploads | Done |
| 3 | Interactive floor plan: tap to pin defects, zoom, severity colours, room layout fallback | Done |
| 4 | Server-side PDF reports (EN/AR, RTL, cover, summary, photos, numbered plan, signatures, versions) | Done |
| 5 | AI defect assistant (suggestions are always labelled preliminary and need human confirmation) | Built; awaiting API key for live test |
| 6 | Plans (Free / Pro annual / pay-per-report), payment integration in test mode, feature limits | Built; awaiting Paymob test keys for an end-to-end payment |
| 7 | Admin dashboard, report share links, legal pages, security review and hardening, E2E tests, deployment | Done |
| Later | Account deletion from Settings, invite collaborators to an inspection, custom domain, Supabase custom SMTP | Backlog |

See `docs/decisions.md` for the main technical decisions and `CHANGELOG.md` for changes.
