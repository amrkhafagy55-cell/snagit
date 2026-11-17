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
