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
