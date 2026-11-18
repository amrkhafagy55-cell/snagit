# SNAGIT — Property Inspection & Snagging

SNAGIT helps apartment buyers, owners, inspectors and civil engineers inspect newly delivered units room by room, record construction defects with photos, and track each defect until it is fixed. Arabic (RTL) and English.

**Status:** Stages 1–6 of 7 are built (see [Roadmap](#roadmap)). Two parts can't run end to end until you add external credentials: the AI assistant (Stage 5, needs an Anthropic API key) and Paymob checkout (Stage 6, needs Paymob keys and the Supabase service-role key). The admin panel (Stage 7) is not built yet.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, Server Actions, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS 4, lucide-react icons, Inter + IBM Plex Sans Arabic |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |
| Validation | zod (server side, every action) |
| Tests | Node test runner + PGlite (real Postgres in-process) for schema and RLS |

## What works today (Stages 1–6)

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
- **Security:** RLS on every table means a user only ever reads or writes their own rows. Storage buckets are private and every file sits under `<user_id>/…`, enforced by storage policies. MIME types and size limits are enforced by Storage itself. Photos are served through signed URLs that expire after 1 hour. The browser only ever gets the anon key.
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

### Grant Pro manually (support or testing without payments)
```sql
insert into public.subscriptions (user_id, plan_id, current_period_start, current_period_end)
select id, 'pro_annual', now(), now() + interval '1 year' from auth.users where email = 'someone@example.com'
on conflict (user_id) do update set status = 'active', current_period_end = excluded.current_period_end;
```

### 3. Make yourself an admin (for later stages)
```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, runs `tsc` |
| `npm test` | Unit tests (Paymob HMAC) + database tests |
| `npm run test:db` | Runs both migrations on in-process Postgres and checks the triggers, numbering, summary view, RLS isolation and storage rules |

## Deployment (Vercel)
1. Push the repo to GitHub and import it in Vercel. The framework preset is Next.js.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` (the production URL).
3. In Supabase, add `https://<your-domain>/auth/callback` to Redirect URLs and set the Site URL.
4. Deploy. No other server is needed: everything else is Supabase.

Any Node 20+ host that runs `next start` works too.

## Database schema

```
auth.users ─1:1─ profiles (role, locale)
profiles ─1:n─ properties ─1:n─ inspections ─┬─1:n─ rooms ─1:n─ checklist_items
                                             ├─1:n─ defects ─1:n─ defect_photos (before/after)
                                             └─1:n─ reports (Stage 4, versioned)
checklist_templates (global, admin-managed) → copied into checklist_items when a room is created
view inspection_summaries (security_invoker) → dashboard and workspace counts
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
| Admin jobs, PDF storage cleanup | `SUPABASE_SERVICE_ROLE_KEY` (server-only) | 4, 7 |

## Roadmap

| Stage | Scope | Status |
|---|---|---|
| 1 | Auth, database, dashboard, property creation | Done |
| 2 | Room inspections, checklists, defects, photo uploads | Done |
| 3 | Interactive floor plan: tap to pin defects, zoom, severity colours, room layout fallback | Done |
| 4 | Server-side PDF reports (EN/AR, RTL, cover, summary, photos, numbered plan, signatures, versions) | Done |
| 5 | AI defect assistant (suggestions are always labelled preliminary and need human confirmation) | Built; awaiting API key for live test |
| 6 | Plans (Free / Pro annual / pay-per-report), payment integration in test mode, feature limits | Built; awaiting Paymob test keys for an end-to-end payment |
| 7 | Admin dashboard, sharing, security review, E2E tests, deployment hardening | Next |

See `docs/decisions.md` for the main technical decisions and `CHANGELOG.md` for changes.
