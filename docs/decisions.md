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

## D-006 — Floor-plan pins are relative coordinates on a raster image (2026-11-18)
**Decision:** A marker is stored as `plan_x`/`plan_y` in 0..1 of the plan image. PDFs are rendered to PNG (page 1, 2400 px long edge) in the browser with pdf.js when uploaded, and the viewer only ever shows that image. Zoom and pan are a small custom component (pointer events, no library), so a tap can be told apart from a drag and markers can be counter-scaled.
**Why:** It works the same for PDF and image plans, needs no server-side PDF tooling, and Stage 4 can draw the same image with numbered markers into the report.
**Consequence:** Only page 1 of a multi-page PDF is used. Duplexes and villas with one plan per floor will need a `floor_plans` table later (backlog).

## D-005 — Default UI language is English (2026-11-17)
The toggle is on every screen. To make Arabic the default, change `DEFAULT_LANG` in `src/lib/i18n/index.ts`. This is a product owner decision.
