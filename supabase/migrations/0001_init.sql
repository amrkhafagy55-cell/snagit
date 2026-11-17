-- SNAGIT — initial schema (Stage 1 + 2)
-- Users → Properties → Inspections → Rooms → Checklist Items → Defects → Photos → Reports
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent where practical.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('individual', 'inspector', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_type as enum
    ('apartment', 'duplex', 'penthouse', 'studio', 'villa', 'townhouse', 'chalet', 'office', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inspection_status as enum ('draft', 'in_progress', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_type as enum
    ('entrance', 'living', 'bedroom', 'kitchen', 'bathroom', 'balcony', 'corridor', 'roof', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.checklist_result as enum ('not_inspected', 'passed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.defect_severity as enum ('critical', 'high', 'medium', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.defect_status as enum
    ('open', 'under_correction', 'pending_reinspection', 'resolved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.photo_kind as enum ('before', 'after');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (char_length(phone) <= 30),
  company     text check (char_length(company) <= 120),
  role        public.user_role not null default 'individual',
  locale      text not null default 'en' check (locale in ('en', 'ar')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user. Only 'individual' or 'inspector'
-- can be chosen at sign-up; 'admin' is granted manually in SQL.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := 'individual';
begin
  if new.raw_user_meta_data ->> 'account_type' = 'inspector' then
    v_role := 'inspector';
  end if;
  insert into public.profiles (id, full_name, role, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120),
    v_role,
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Users may switch between individual and inspector, never to admin.
create or replace function public.set_account_type(p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type not in ('individual', 'inspector') then
    raise exception 'invalid account type';
  end if;
  update public.profiles
     set role = p_type::public.user_role
   where id = auth.uid() and role <> 'admin';
end $$;

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_name     text not null check (char_length(project_name) between 1 and 150),
  developer_name   text not null default '' check (char_length(developer_name) <= 150),
  building_number  text not null default '' check (char_length(building_number) <= 30),
  apartment_number text not null default '' check (char_length(apartment_number) <= 30),
  floor_number     text not null default '' check (char_length(floor_number) <= 30),
  property_type    public.property_type not null default 'apartment',
  bedrooms         smallint not null default 0 check (bedrooms between 0 and 20),
  bathrooms        smallint not null default 0 check (bathrooms between 0 and 20),
  owner_name       text not null default '' check (char_length(owner_name) <= 150),
  address          text not null default '' check (char_length(address) <= 300),
  notes            text not null default '' check (char_length(notes) <= 4000),
  floor_plan_path  text,
  floor_plan_mime  text check (floor_plan_mime in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists properties_owner_idx on public.properties (owner_id);

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Inspections (one property can be inspected several times: handover, reinspection…)
-- ---------------------------------------------------------------------------
create table if not exists public.inspections (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties (id) on delete cascade,
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  inspection_date  date not null default current_date,
  inspector_name   text not null default '' check (char_length(inspector_name) <= 150),
  status           public.inspection_status not null default 'in_progress',
  general_remarks  text not null default '' check (char_length(general_remarks) <= 8000),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists inspections_owner_idx on public.inspections (owner_id, updated_at desc);
create index if not exists inspections_property_idx on public.inspections (property_id);

drop trigger if exists inspections_touch on public.inspections;
create trigger inspections_touch before update on public.inspections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  inspection_id  uuid not null references public.inspections (id) on delete cascade,
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  room_type      public.room_type not null,
  type_index     smallint not null default 1,
  name           text check (char_length(name) <= 80),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists rooms_inspection_idx on public.rooms (inspection_id, sort_order);

-- ---------------------------------------------------------------------------
-- Checklist templates (global, admin-managed; copied into each room)
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  room_type   public.room_type not null,
  category    text not null,
  title_en    text not null,
  title_ar    text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  unique (room_type, category, title_en)
);

-- ---------------------------------------------------------------------------
-- Checklist items
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms (id) on delete cascade,
  inspection_id  uuid not null references public.inspections (id) on delete cascade,
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  template_id    uuid references public.checklist_templates (id) on delete set null,
  category       text not null check (char_length(category) between 1 and 60),
  title_en       text not null default '' check (char_length(title_en) <= 200),
  title_ar       text not null default '' check (char_length(title_ar) <= 200),
  result         public.checklist_result not null default 'not_inspected',
  notes          text not null default '' check (char_length(notes) <= 2000),
  is_custom      boolean not null default false,
  sort_order     integer not null default 0,
  updated_at     timestamptz not null default now(),
  check (title_en <> '' or title_ar <> '')
);
create index if not exists checklist_room_idx on public.checklist_items (room_id, sort_order);
create index if not exists checklist_inspection_idx on public.checklist_items (inspection_id);

drop trigger if exists checklist_touch on public.checklist_items;
create trigger checklist_touch before update on public.checklist_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Defects
-- ---------------------------------------------------------------------------
create table if not exists public.defects (
  id                  uuid primary key default gen_random_uuid(),
  inspection_id       uuid not null references public.inspections (id) on delete cascade,
  room_id             uuid references public.rooms (id) on delete set null,
  checklist_item_id   uuid references public.checklist_items (id) on delete set null,
  owner_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  number              integer not null default 0,
  title               text not null check (char_length(title) between 1 and 200),
  description         text not null default '' check (char_length(description) <= 4000),
  category            text not null check (char_length(category) between 1 and 60),
  severity            public.defect_severity not null default 'medium',
  status              public.defect_status not null default 'open',
  recommended_action  text not null default '' check (char_length(recommended_action) <= 4000),
  identified_on       date not null default current_date,
  responsible_party   text not null default '' check (char_length(responsible_party) <= 150),
  location_note       text not null default '' check (char_length(location_note) <= 200),
  plan_x              numeric(6,5) check (plan_x between 0 and 1),  -- Stage 3: floor-plan marker (relative)
  plan_y              numeric(6,5) check (plan_y between 0 and 1),
  reinspection_notes  text not null default '' check (char_length(reinspection_notes) <= 4000),
  corrected_on        date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (inspection_id, number)
);
create index if not exists defects_inspection_idx on public.defects (inspection_id, number);
create index if not exists defects_owner_idx on public.defects (owner_id);
create index if not exists defects_item_idx on public.defects (checklist_item_id);

-- Automatic per-inspection numbering (D-1, D-2 …), safe under concurrency.
create or replace function public.assign_defect_number()
returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.inspection_id::text));
  select coalesce(max(number), 0) + 1 into new.number
    from public.defects where inspection_id = new.inspection_id;
  return new;
end $$;

drop trigger if exists defects_number on public.defects;
create trigger defects_number before insert on public.defects
  for each row execute function public.assign_defect_number();

drop trigger if exists defects_touch on public.defects;
create trigger defects_touch before update on public.defects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Defect photos
-- ---------------------------------------------------------------------------
create table if not exists public.defect_photos (
  id            uuid primary key default gen_random_uuid(),
  defect_id     uuid not null references public.defects (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  storage_path  text not null unique,
  kind          public.photo_kind not null default 'before',
  caption       text not null default '' check (char_length(caption) <= 300),
  width         integer,
  height        integer,
  taken_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists defect_photos_defect_idx on public.defect_photos (defect_id, created_at);

-- ---------------------------------------------------------------------------
-- Reports (Stage 4 writes rows; versions are preserved)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  inspection_id  uuid not null references public.inspections (id) on delete cascade,
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  version        integer not null,
  language       text not null check (language in ('en', 'ar')),
  storage_path   text not null,
  created_at     timestamptz not null default now(),
  unique (inspection_id, version, language)
);

-- ---------------------------------------------------------------------------
-- Keep inspections.updated_at fresh when their content changes
-- ---------------------------------------------------------------------------
create or replace function public.touch_parent_inspection()
returns trigger language plpgsql as $$
declare
  v_id uuid := coalesce(new.inspection_id, old.inspection_id);
begin
  update public.inspections set updated_at = now() where id = v_id;
  return null;
end $$;

drop trigger if exists checklist_touch_parent on public.checklist_items;
create trigger checklist_touch_parent after insert or update or delete on public.checklist_items
  for each row execute function public.touch_parent_inspection();

drop trigger if exists defects_touch_parent on public.defects;
create trigger defects_touch_parent after insert or update or delete on public.defects
  for each row execute function public.touch_parent_inspection();

drop trigger if exists rooms_touch_parent on public.rooms;
create trigger rooms_touch_parent after insert or delete on public.rooms
  for each row execute function public.touch_parent_inspection();

-- ---------------------------------------------------------------------------
-- Room + checklist initialisation (runs with the caller's rights → RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.add_room(
  p_inspection_id uuid, p_room_type public.room_type, p_name text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_room_id uuid;
  v_index   smallint;
  v_order   integer;
begin
  select coalesce(max(type_index), 0) + 1 into v_index
    from rooms where inspection_id = p_inspection_id and room_type = p_room_type;
  select coalesce(max(sort_order), 0) + 10 into v_order
    from rooms where inspection_id = p_inspection_id;

  insert into rooms (inspection_id, room_type, type_index, name, sort_order)
  values (p_inspection_id, p_room_type, v_index, nullif(trim(p_name), ''), v_order)
  returning id into v_room_id;

  insert into checklist_items (room_id, inspection_id, template_id, category, title_en, title_ar, sort_order)
  select v_room_id, p_inspection_id, t.id, t.category, t.title_en, t.title_ar, t.sort_order
    from checklist_templates t
   where t.room_type = p_room_type and t.is_active;

  return v_room_id;
end $$;

create or replace function public.initialize_inspection(
  p_inspection_id uuid, p_bedrooms int, p_bathrooms int, p_balconies int, p_has_roof boolean
) returns void language plpgsql security invoker set search_path = public as $$
declare i int;
begin
  if exists (select 1 from rooms where inspection_id = p_inspection_id) then
    return;
  end if;
  perform add_room(p_inspection_id, 'entrance');
  perform add_room(p_inspection_id, 'living');
  perform add_room(p_inspection_id, 'kitchen');
  perform add_room(p_inspection_id, 'corridor');
  for i in 1 .. greatest(least(p_bedrooms, 20), 0) loop perform add_room(p_inspection_id, 'bedroom'); end loop;
  for i in 1 .. greatest(least(p_bathrooms, 20), 0) loop perform add_room(p_inspection_id, 'bathroom'); end loop;
  for i in 1 .. greatest(least(p_balconies, 10), 0) loop perform add_room(p_inspection_id, 'balcony'); end loop;
  if p_has_roof then perform add_room(p_inspection_id, 'roof'); end if;
end $$;

-- ---------------------------------------------------------------------------
-- Summary view for dashboard / cards (security_invoker → RLS of the caller)
-- ---------------------------------------------------------------------------
create or replace view public.inspection_summaries
with (security_invoker = true) as
select
  i.id,
  i.property_id,
  i.owner_id,
  i.status,
  i.inspection_date,
  i.inspector_name,
  i.updated_at,
  i.created_at,
  p.project_name,
  p.developer_name,
  p.building_number,
  p.apartment_number,
  p.floor_number,
  p.property_type,
  p.address,
  coalesce(c.total, 0)          as items_total,
  coalesce(c.passed, 0)         as items_passed,
  coalesce(c.failed, 0)         as items_failed,
  coalesce(d.total, 0)          as defects_total,
  coalesce(d.open_total, 0)     as defects_open,
  coalesce(d.critical, 0)       as defects_critical,
  coalesce(d.high, 0)           as defects_high,
  coalesce(d.medium, 0)         as defects_medium,
  coalesce(d.low, 0)            as defects_low
from public.inspections i
join public.properties p on p.id = i.property_id
left join lateral (
  select count(*) as total,
         count(*) filter (where ci.result = 'passed') as passed,
         count(*) filter (where ci.result = 'failed') as failed
    from public.checklist_items ci where ci.inspection_id = i.id
) c on true
left join lateral (
  select count(*) as total,
         count(*) filter (where df.status not in ('resolved', 'rejected')) as open_total,
         count(*) filter (where df.severity = 'critical') as critical,
         count(*) filter (where df.severity = 'high') as high,
         count(*) filter (where df.severity = 'medium') as medium,
         count(*) filter (where df.severity = 'low') as low
    from public.defects df where df.inspection_id = i.id
) d on true;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.properties          enable row level security;
alter table public.inspections         enable row level security;
alter table public.rooms               enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.defects             enable row level security;
alter table public.defect_photos       enable row level security;
alter table public.reports             enable row level security;

-- Profiles: read/update own row; role is changed only through set_account_type().
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, company, locale) on public.profiles to authenticated;

-- Properties
drop policy if exists properties_all on public.properties;
create policy properties_all on public.properties for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Inspections: must belong to a property the user owns.
drop policy if exists inspections_all on public.inspections;
create policy inspections_all on public.inspections for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))
  );

-- Rooms
drop policy if exists rooms_all on public.rooms;
create policy rooms_all on public.rooms for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid()))
  );

-- Checklist templates: everyone signed in reads; only admins write.
drop policy if exists templates_read on public.checklist_templates;
create policy templates_read on public.checklist_templates for select to authenticated using (true);
drop policy if exists templates_admin on public.checklist_templates;
create policy templates_admin on public.checklist_templates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Checklist items
drop policy if exists checklist_all on public.checklist_items;
create policy checklist_all on public.checklist_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.rooms r
                 where r.id = room_id and r.inspection_id = checklist_items.inspection_id
                   and r.owner_id = (select auth.uid()))
  );

-- Defects
drop policy if exists defects_all on public.defects;
create policy defects_all on public.defects for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid()))
    and (room_id is null or exists (select 1 from public.rooms r where r.id = room_id and r.inspection_id = defects.inspection_id))
    and (checklist_item_id is null or exists (select 1 from public.checklist_items ci where ci.id = checklist_item_id and ci.inspection_id = defects.inspection_id))
  );

-- Defect photos: path must live in the user's storage folder.
drop policy if exists defect_photos_all on public.defect_photos;
create policy defect_photos_all on public.defect_photos for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.defects d where d.id = defect_id and d.owner_id = (select auth.uid()))
  );

-- Reports
drop policy if exists reports_all on public.reports;
create policy reports_all on public.reports for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid()))
  );

grant select on public.inspection_summaries to authenticated;
grant execute on function public.add_room(uuid, public.room_type, text) to authenticated;
grant execute on function public.initialize_inspection(uuid, int, int, int, boolean) to authenticated;
grant execute on function public.set_account_type(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets (private) + policies: objects live under "<user_id>/..."
-- Size and MIME limits are enforced by Storage itself, not only by the client.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('floor-plans',   'floor-plans',   false, 15728640, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('defect-photos', 'defect-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('reports',       'reports',       false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists snagit_storage_select on storage.objects;
create policy snagit_storage_select on storage.objects for select to authenticated
  using (bucket_id in ('floor-plans', 'defect-photos', 'reports')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists snagit_storage_insert on storage.objects;
create policy snagit_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('floor-plans', 'defect-photos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists snagit_storage_update on storage.objects;
create policy snagit_storage_update on storage.objects for update to authenticated
  using (bucket_id in ('floor-plans', 'defect-photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists snagit_storage_delete on storage.objects;
create policy snagit_storage_delete on storage.objects for delete to authenticated
  using (bucket_id in ('floor-plans', 'defect-photos', 'reports')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
