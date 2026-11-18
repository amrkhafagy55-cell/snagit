// Runs the real migrations on an in-process Postgres (PGlite) with minimal stubs of
// Supabase's `auth` and `storage` schemas, then checks schema logic and RLS isolation.
// Usage: npm run test:db
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema auth, storage, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant all on storage.objects to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

async function as(userId, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;

let inspectionA;

before(async () => {
  await db.exec(STUBS);
  await db.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../migrations/0002_checklist_templates.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../migrations/0003_floor_plan_mapping.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../migrations/0004_reports.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../migrations/0005_ai_requests.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../migrations/0006_billing.sql", import.meta.url), "utf8"));
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@test.dev', $2), ($3, 'b@test.dev', $4)`, [
    A, JSON.stringify({ full_name: "Amina Inspector", account_type: "inspector", locale: "ar" }),
    B, JSON.stringify({ full_name: "Bob", account_type: "admin" }),
  ]);
});

test("profiles are created by trigger; admin cannot be self-assigned at sign-up", async () => {
  const a = await one(`select full_name, role, locale from public.profiles where id = $1`, [A]);
  assert.deepEqual(a, { full_name: "Amina Inspector", role: "inspector", locale: "ar" });
  const b = await one(`select role from public.profiles where id = $1`, [B]);
  assert.equal(b.role, "individual");
});

test("templates are seeded for every room type", async () => {
  const r = await rows(`select room_type, count(*)::int as n from public.checklist_templates group by 1 order by 1`);
  assert.equal(r.length, 9);
  assert.ok(r.every((x) => x.n >= 6));
});

test("owner can create property → inspection → rooms + checklist", async () => {
  await as(A, async () => {
    const p = await one(`insert into public.properties (project_name, bedrooms, bathrooms) values ('Test Compound', 3, 2) returning id, owner_id`);
    assert.equal(p.owner_id, A);
    const i = await one(`insert into public.inspections (property_id) values ($1) returning id`, [p.id]);
    inspectionA = i.id;
    await db.query(`select public.initialize_inspection($1, 3, 2, 1, true)`, [i.id]);
    // idempotent
    await db.query(`select public.initialize_inspection($1, 3, 2, 1, true)`, [i.id]);
    const rooms = await rows(`select room_type, type_index from public.rooms where inspection_id = $1 order by sort_order`, [i.id]);
    assert.equal(rooms.length, 4 + 3 + 2 + 1 + 1);
    assert.deepEqual(rooms.filter((r) => r.room_type === "bedroom").map((r) => r.type_index), [1, 2, 3]);
    const items = await one(`select count(*)::int n from public.checklist_items where inspection_id = $1`, [i.id]);
    assert.ok(items.n > 80, `expected >80 items, got ${items.n}`);
  });
});

test("defects get sequential numbers and the summary view counts them", async () => {
  await as(A, async () => {
    const room = await one(`select id from public.rooms where inspection_id = $1 and room_type = 'kitchen'`, [inspectionA]);
    const nums = [];
    for (const sev of ["critical", "high", "low"]) {
      const d = await one(
        `insert into public.defects (inspection_id, room_id, title, category, severity) values ($1, $2, 'Leak', 'plumbing', $3) returning number`,
        [inspectionA, room.id, sev],
      );
      nums.push(d.number);
    }
    assert.deepEqual(nums, [1, 2, 3]);
    await db.query(`update public.checklist_items set result = 'passed' where id in (select id from public.checklist_items where inspection_id = $1 limit 10)`, [inspectionA]);
    const s = await one(`select items_passed, defects_total, defects_critical, defects_high, defects_low, defects_open from public.inspection_summaries where id = $1`, [inspectionA]);
    assert.deepEqual(
      { ...s, items_passed: Number(s.items_passed), defects_total: Number(s.defects_total), defects_critical: Number(s.defects_critical), defects_high: Number(s.defects_high), defects_low: Number(s.defects_low), defects_open: Number(s.defects_open) },
      { items_passed: 10, defects_total: 3, defects_critical: 1, defects_high: 1, defects_low: 1, defects_open: 3 },
    );
  });
});

test("Free plan: 10 defects, no pins, no after photos, one active inspection; unlock and Pro lift limits", async () => {
  const limit = (code) => new RegExp("SNAGIT_LIMIT:" + code);
  await as(A, async () => {
    const ent = (await one(`select public.my_entitlements() e`)).e;
    assert.equal(ent.pro, false);
    assert.equal(ent.max_defects_per_inspection, 10);
    assert.equal(ent.active_inspections, 1);
    // 3 defects exist; 7 more reach the limit, the 11th is refused
    for (let i = 0; i < 7; i++) {
      await db.query(`insert into public.defects (inspection_id, title, category) values ($1, 'd', 'architectural')`, [inspectionA]);
    }
    await assert.rejects(db.query(`insert into public.defects (inspection_id, title, category) values ($1, 'x', 'architectural')`, [inspectionA]), limit("defects"));
    const d = await one(`select id from public.defects where inspection_id = $1 order by number limit 1`, [inspectionA]);
    await assert.rejects(db.query(`update public.defects set plan_x = 0.2, plan_y = 0.2 where id = $1`, [d.id]), limit("plan"));
    await assert.rejects(
      db.query(`insert into public.defect_photos (defect_id, storage_path, kind) values ($1, $2, 'after')`, [d.id, `${A}/${inspectionA}/${d.id}/a.jpg`]),
      limit("after_photos"),
    );
    const p2 = await one(`insert into public.properties (project_name) values ('Second unit') returning id`);
    await assert.rejects(db.query(`insert into public.inspections (property_id) values ($1)`, [p2.id]), limit("active_inspections"));
    // completed inspections don't count as active
    await db.query(`insert into public.inspections (property_id, status) values ($1, 'completed')`, [p2.id]);
    assert.equal(await one(`select public.inspection_unlocked($1) u`, [inspectionA]).then((r) => r.u), false);
    // users can't create payments or grant themselves entitlements
    await assert.rejects(db.query(`insert into public.payments (user_id, kind, amount_cents, currency) values ($1, 'pro_annual', 1, 'EGP')`, [A]), /row-level security/);
    await assert.rejects(db.query(`insert into public.inspection_unlocks (inspection_id, user_id) values ($1, $2)`, [inspectionA, A]), /row-level security/);
    await assert.rejects(db.query(`insert into public.subscriptions (user_id, plan_id, current_period_start, current_period_end) values ($1, 'pro_annual', now(), now() + interval '1 year')`, [A]), /row-level security/);
  });

  // Server (service role) records a paid single report → that inspection is unlocked
  await db.query(`insert into public.inspection_unlocks (inspection_id, user_id) values ($1, $2)`, [inspectionA, A]);
  await as(A, async () => {
    assert.equal((await one(`select public.inspection_unlocked($1) u`, [inspectionA])).u, true);
    await db.query(`insert into public.defects (inspection_id, title, category) values ($1, 'eleventh', 'architectural')`, [inspectionA]);
    const p3 = await one(`select id from public.properties where project_name = 'Second unit'`);
    await assert.rejects(db.query(`insert into public.inspections (property_id) values ($1)`, [p3.id]), limit("active_inspections"));
  });
  await db.query(`delete from public.inspection_unlocks where inspection_id = $1`, [inspectionA]);

  // Server records an annual subscription → Pro everywhere
  await db.query(`insert into public.subscriptions (user_id, plan_id, current_period_start, current_period_end) values ($1, 'pro_annual', now(), now() + interval '1 year')`, [A]);
  await as(A, async () => {
    const ent = (await one(`select public.my_entitlements() e`)).e;
    assert.equal(ent.pro, true);
    const p3 = await one(`select id from public.properties where project_name = 'Second unit'`);
    const extra = await one(`insert into public.inspections (property_id) values ($1) returning id`, [p3.id]);
    await db.query(`delete from public.inspections where id = $1`, [extra.id]);
    await db.query(`delete from public.properties where id = $1`, [p3.id]);
  });
  // Expired subscription → back to Free
  await db.query(`update public.subscriptions set current_period_end = now() - interval '1 day' where user_id = $1`, [A]);
  await as(A, async () => {
    assert.equal((await one(`select public.my_entitlements() e`)).e.pro, false);
    // Another user can't learn anything about A's inspection
  });
  await as(B, async () => {
    assert.equal((await one(`select public.inspection_unlocked($1) u`, [inspectionA])).u, false);
    assert.equal((await one(`select count(*)::int n from public.plans`)).n, 3);
  });
});

test("another user sees nothing and cannot write into someone else's inspection", async () => {
  await as(B, async () => {
    for (const t of ["properties", "inspections", "rooms", "checklist_items", "defects", "inspection_summaries"]) {
      const r = await one(`select count(*)::int n from public.${t}`);
      assert.equal(r.n, 0, `${t} leaked`);
    }
    await assert.rejects(
      db.query(`insert into public.defects (inspection_id, title, category) values ($1, 'x', 'y')`, [inspectionA]),
      /row-level security/,
    );
    const upd = await db.query(`update public.checklist_items set result = 'failed' where inspection_id = $1`, [inspectionA]);
    assert.equal(upd.affectedRows ?? 0, 0);
    await assert.rejects(db.query(`select public.add_room($1, 'other')`, [inspectionA]), /row-level security/);
  });
});

test("floor plan pins: owner can pin, coordinates come in pairs, others cannot move them", async () => {
  await db.query(`insert into public.inspection_unlocks (inspection_id, user_id) values ($1, $2) on conflict do nothing`, [inspectionA, A]);
  await as(A, async () => {
    await db.query(`update public.properties set floor_plan_image_path = 'x.png', floor_plan_width = 1400, floor_plan_height = 1000`);
    const d = await one(`select id from public.defects where inspection_id = $1 order by number limit 1`, [inspectionA]);
    await db.query(`update public.defects set plan_x = 0.25, plan_y = 0.75 where id = $1`, [d.id]);
    const pin = await one(`select plan_x::float8 x, plan_y::float8 y from public.defects where id = $1`, [d.id]);
    assert.deepEqual(pin, { x: 0.25, y: 0.75 });
    await assert.rejects(db.query(`update public.defects set plan_x = 0.5, plan_y = null where id = $1`, [d.id]), /defects_plan_xy_pair/);
    await assert.rejects(db.query(`update public.defects set plan_x = 1.5, plan_y = 0.5 where id = $1`, [d.id]), /check constraint/);
  });
  await as(B, async () => {
    const r = await db.query(`update public.defects set plan_x = 0.1, plan_y = 0.1`);
    assert.equal(r.affectedRows ?? 0, 0);
  });
});

test("report versions: owner adds and reads them, cannot edit, others see nothing", async () => {
  await as(A, async () => {
    const path = `${A}/${inspectionA}/report-v1-en.pdf`;
    await db.query(`insert into public.reports (inspection_id, version, language, storage_path, summary, byte_size, page_count)
                    values ($1, 1, 'en', $2, '{"defects_total":3}', 1024, 5)`, [inspectionA, path]);
    await assert.rejects(
      db.query(`insert into public.reports (inspection_id, version, language, storage_path) values ($1, 2, 'en', $2)`, [inspectionA, `${B}/x.pdf`]),
      /row-level security/,
    );
    const upd = await db.query(`update public.reports set version = 9`);
    assert.equal(upd.affectedRows ?? 0, 0, "reports must be immutable");
    await db.query(`insert into storage.objects (bucket_id, name) values ('reports', $1)`, [path]);
    const r = await one(`select count(*)::int n, max((summary->>'defects_total')::int) t from public.reports`);
    assert.deepEqual(r, { n: 1, t: 3 });
  });
  await as(B, async () => {
    assert.equal((await one(`select count(*)::int n from public.reports`)).n, 0);
    await assert.rejects(
      db.query(`insert into storage.objects (bucket_id, name) values ('reports', $1)`, [`${A}/steal.pdf`]),
      /row-level security/,
    );
  });
});

test("AI usage log: users log and count their own requests only", async () => {
  await as(A, async () => {
    await db.query(`insert into public.ai_requests (inspection_id, kind, model, input_tokens, output_tokens, image_count) values ($1, 'analyze', 'claude-opus-5-5', 4200, 600, 2)`, [inspectionA]);
    await db.query(`insert into public.ai_requests (kind) values ('improve')`);
    const r = await one(`select count(*)::int n from public.ai_requests where created_at > now() - interval '24 hours'`);
    assert.equal(r.n, 2);
    const upd = await db.query(`update public.ai_requests set input_tokens = 0`);
    assert.equal(upd.affectedRows ?? 0, 0, "log must be append-only");
  });
  await as(B, async () => {
    assert.equal((await one(`select count(*)::int n from public.ai_requests`)).n, 0);
    await assert.rejects(
      db.query(`insert into public.ai_requests (inspection_id, kind) values ($1, 'analyze')`, [inspectionA]),
      /row-level security/,
    );
  });
});

test("users cannot promote themselves to admin", async () => {
  await as(B, async () => {
    await assert.rejects(db.query(`update public.profiles set role = 'admin' where id = $1`, [B]), /permission denied/);
    await assert.rejects(db.query(`select public.set_account_type('admin')`), /invalid account type/);
    await db.query(`select public.set_account_type('inspector')`);
    await db.query(`update public.profiles set full_name = 'Bob B.' where id = $1`, [B]);
  });
  const b = await one(`select role, full_name from public.profiles where id = $1`, [B]);
  assert.deepEqual(b, { role: "inspector", full_name: "Bob B." });
});

test("photos must live in the owner's storage folder", async () => {
  await as(A, async () => {
    const d = await one(`select id from public.defects where inspection_id = $1 limit 1`, [inspectionA]);
    await db.query(`insert into public.defect_photos (defect_id, storage_path) values ($1, $2)`, [d.id, `${A}/${inspectionA}/${d.id}/x.jpg`]);
    await assert.rejects(
      db.query(`insert into public.defect_photos (defect_id, storage_path) values ($1, $2)`, [d.id, `${B}/evil.jpg`]),
      /row-level security/,
    );
    await db.query(`insert into storage.objects (bucket_id, name) values ('defect-photos', $1)`, [`${A}/${inspectionA}/a.jpg`]);
    await assert.rejects(
      db.query(`insert into storage.objects (bucket_id, name) values ('defect-photos', $1)`, [`${B}/a.jpg`]),
      /row-level security/,
    );
  });
  await as(B, async () => {
    const r = await one(`select count(*)::int n from storage.objects`);
    assert.equal(r.n, 0);
  });
});

test("deleting the property cascades to everything", async () => {
  await as(A, async () => {
    await db.query(`delete from public.properties`);
    for (const t of ["inspections", "rooms", "checklist_items", "defects", "defect_photos"]) {
      const r = await one(`select count(*)::int n from public.${t}`);
      assert.equal(r.n, 0, `${t} not cascaded`);
    }
  });
});
