# Technical decisions

Short records of decisions that shape the codebase. Add a new entry rather than editing old ones.

## D-001 — Next.js 16 with Cache Components turned off (2026-11-17)
**Context:** `create-next-app` for Next 16 enables `cacheComponents` and `partialPrefetching`. Under Cache Components, every request-time read (such as the auth cookie) has to sit behind a `<Suspense>` boundary. Almost every SNAGIT page is per-user.
**Decision:** Turn both flags off and use classic dynamic rendering. Pages read the user with `getUser()` (`supabase.auth.getClaims()`, which verifies the JWT), cached per request.
**Consequence:** Simpler code now. The Next.js docs say both flags become the default in the next major version, so plan a migration (wrap session reads in Suspense, `use cache: private`) before upgrading.

## D-002 — Supabase RLS is the authorisation layer (2026-11-17)
**Decision:** Every table has RLS on. Every child table carries `owner_id default auth.uid()`. Write policies also check that the parent row has the same owner. Server actions use the user's own session (anon key + cookie), never the service-role key.
**Consequence:** A bug in a server action cannot leak another user's data. Sharing (Stage 7) will add an `inspection_members` table and a security-definer `can_access_inspection()` helper used by the policies. Tested in `supabase/tests/rls.test.mjs`.

## D-003 — Browser uploads straight to private Storage (2026-11-17)
**Decision:** Photos and floor plans upload from the browser to Supabase Storage, under `<user_id>/…` paths that storage policies enforce. A server action then records the path after checking its prefix. Images are resized to at most 2048 px and re-encoded as JPEG in the browser.
**Why:** Server Actions have a 1 MB body limit, and phones on site have weak networks. Re-encoding also strips EXIF/GPS data.
**Consequence:** If an upload half-succeeds, orphaned objects can remain. A cleanup job is planned (Stage 7).

## D-004 — Bilingual checklist content stored in rows (2026-11-17)
**Decision:** Templates and checklist items store both `title_en` and `title_ar`. UI strings live in `src/lib/i18n/{en,ar}.ts`; `ar` is typed against `en`, so a missing key fails the build. The language lives in a cookie and is mirrored to `profiles.locale`.
**Consequence:** Reports (Stage 4) can render in either language whatever language the inspection was done in. Custom items store the user's text in both fields.

## D-014 — End-to-end tests with Playwright in the installed Chrome (2026-11-18)
**Decision:** `npm run test:e2e` runs Playwright with `channel: "chrome"`, so no browser download is needed. Public pages run on desktop and a Pixel 7 viewport. The signed-in journey uses a dedicated Free, non-admin test account from `.env.local` (`E2E_EMAIL`, `E2E_PASSWORD`), cleans up after itself, and is skipped without credentials. `E2E_BASE_URL` points the suite at a deployed site.
**Why:** It tests the real Supabase project and real PDF rendering without a second database. Product owner decision (2026-11-18).
**Consequences:** E2E runs write to the real project, under the test account only. The test account must stay Free and not be an admin, or the limit and 404 assertions change.

## D-013 — Security headers and a CSP with inline scripts allowed (2026-11-18)
**Decision:** `next.config.ts` sends the CSP plus HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` on every route.
- The CSP allows only this site and the Supabase project for connections, images and form targets, with `frame-ancestors 'none'` and `object-src 'none'`.
- Share pages add `no-referrer` and `noindex`.
- `script-src` keeps `'unsafe-inline'` (Next.js bootstrap) and `'wasm-unsafe-eval'` (pdf.js).
**Why:** It blocks clickjacking, mixed content and most injection follow-ups now, without per-request nonces, which would add middleware work and conflict with static rendering.
**Consequences:** Any new third-party origin (analytics, a CDN, another payment page) must be added to the CSP in `next.config.ts`, or the browser will block it. Revisit nonces with Cache Components (D-001).

## D-012 — Report share links: token lookup in SQL, file signed by the server (2026-11-18)
**Decision:**
- A share is a row in `report_shares`: a 64-hex token, an expiry of at most 91 days, `revoked_at` and a download count.
- Anyone can call `get_report_share` / `open_report_share` (security definer) with a token. Only a live token returns data.
- The `/s/[token]/download` route then signs a 60-second URL for that single file with the service-role key.
- Owners can only revoke links (column grant plus RLS).
- Without `SUPABASE_SERVICE_ROLE_KEY` the Share button is hidden.

**Why:** Storage objects stay private. A public storage policy would let anyone list every shared file, and a long-lived signed URL couldn't be revoked. Product owner chose link sharing over inviting collaborators for now (2026-11-18).

**Consequences:** The service-role key is used in one public route, only after the database has validated the token. Inviting collaborators to an inspection (with an `inspection_members` table and policy changes) stays in the backlog.

## D-011 — Admin model: RLS for global config, security-definer functions for everything else (2026-11-18)
**Decision:**
- Admins edit global tables (plans, checklist templates, defect categories, app settings) through RLS "admin" policies. Delete is revoked where it would break the app.
- Cross-user reads and user changes go through `admin_*` functions. Each starts with `assert_admin()` and logs to the append-only `admin_audit`.
- Triggers log every config edit, with a field-by-field diff.
- Admins get **metadata only** for other users' inspections: no defect text, photos or reports (product owner decision, 2026-11-18).
- The `/admin` layout returns 404 to non-admins.

**Why:** The service-role key never enters admin flows, every admin action is checked by the database, and every change leaves a trace.

**Consequences:**
- Supporting a customer's content needs the customer to share a report link.
- Refunds are made in the Paymob dashboard. Admin → Users then ends Pro by hand.
- Defect categories are rows referenced by key, so hiding one never breaks old defects.

## D-010 — Hosting: Vercel, functions in Dublin, deployed with the CLI (2026-11-18)
**Decision:** Production runs on Vercel (project `snagit`, Hobby plan for now). `vercel.json` pins functions to `dub1` because the Supabase project is in `eu-west-1`; every page makes several sequential Supabase calls, so a transatlantic default region (`iad1`) would add latency to each one. Deploys go through `vercel deploy --prod` from this folder until a Git remote exists. `siteUrl()` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, so `NEXT_PUBLIC_SITE_URL` isn't needed on Vercel and a custom domain is picked up without a rebuild.
**Consequences:** No automatic deploys or preview URLs per branch until the repo is pushed to GitHub and connected. The Hobby plan doesn't allow commercial use, so moving to Pro is a launch prerequisite. Changing the Supabase region means changing `vercel.json`.

## D-009 — Billing: Paymob, entitlements enforced in the database (2026-11-18)
**Decision (product owner):** Paymob for Egypt. Pro annual EGP 2,499. Single report EGP 399, which unlocks the whole inspection. Free = 1 active inspection + 10 defects + watermarked report; floor-plan pinning and after photos are Pro-only.
**Technical:** Limits are BEFORE-triggers that raise `SNAGIT_LIMIT:<code>`, so the anon key + user session can't bypass them. Entitlement helpers: `has_pro`, `inspection_unlocked` and `my_entitlements`. Payments, subscriptions and unlocks are written only with the service-role key. The webhook verifies HMAC-SHA512 over Paymob's 20 documented fields (constant-time compare), checks the amount and currency against our row, and is idempotent. Redirects never change state.
**Consequences:** Webhooks need a public URL (a tunnel for local tests). Paymob's GET redirect HMAC isn't used. Refunds and cancellations are manual (SQL) until the admin panel. "Inspection history" stays available to Free users, because the Free limit counts only active inspections.

## D-008 — AI assistant: one structured call, human applies each field (2026-11-18)
**Decision:** A single `client.beta.messages.parse` call to `claude-opus-5-5` (effort `medium`, adaptive thinking) returns a Zod-validated suggestion. `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) retries a safety-classifier decline on Anthropic's recommended model. The key lives only on the server, the feature is hidden without it, and every call is logged with a per-user daily cap that fails closed if the log table is missing.
**Why:** The spec requires suggestions to be preliminary and human-confirmed. A per-field "Use" button plus a normal Save keeps the person in control. One call keeps latency (~10–20 s) and cost (~$0.03–0.05) predictable.
**Consequences:** No AI flag is stored on the defect yet: accepted text becomes the user's text. Costs depend on the Anthropic account. Stage 6 can tie the daily cap to the plan.

## D-007 — PDF reports via headless Chromium (2026-11-18)
**Decision:** The report is HTML/CSS rendered to PDF by Chromium (`puppeteer-core`) on the server. Locally it uses the installed Chrome/Edge; on Vercel/Lambda it uses `@sparticuz/chromium`. Fonts (Inter, IBM Plex Sans Arabic) and images are embedded as data URIs, and request interception blocks every non-`data:` request.
**Why:** It's the only option tested that shapes Arabic and lays out RTL correctly, and it gives vector text, CSS print layout and page numbers. pdfkit, pdfmake and react-pdf don't shape Arabic or handle bidi reliably.
**Consequences:** Generation takes ~10–20 s and needs ~1 GB of function memory on serverless. Chrome stores Arabic as shaped glyphs, so **copying or searching Arabic text inside the PDF is unreliable** (it looks and prints correctly). The footer template can't use the embedded fonts, so it is Latin-only. Free-plan watermark/limits come in Stage 6.

## D-006 — Floor-plan pins are relative coordinates on a raster image (2026-11-18)
**Decision:** A marker is stored as `plan_x`/`plan_y` in 0..1 of the plan image. PDFs are rendered to PNG (page 1, 2400 px long edge) in the browser with pdf.js when uploaded, and the viewer only ever shows that image. Zoom and pan are a small custom component (pointer events, no library), so a tap can be told apart from a drag and markers can be counter-scaled.
**Why:** It works the same for PDF and image plans, needs no server-side PDF tooling, and Stage 4 can draw the same image with numbered markers into the report.
**Consequence:** Only page 1 of a multi-page PDF is used. Duplexes and villas with one plan per floor will need a `floor_plans` table later (backlog).

## D-005 — Default UI language is English (2026-11-17)
The toggle is on every screen. To make Arabic the default, change `DEFAULT_LANG` in `src/lib/i18n/index.ts`. This is a product owner decision.
