# Changelog

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
