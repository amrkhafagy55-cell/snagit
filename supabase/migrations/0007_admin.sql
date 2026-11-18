-- SNAGIT — Stage 7: admin panel, defect categories, app settings, audit log, report share links
-- Run after 0001–0006 (0005 too: the admin analytics count AI requests). Safe to run more than once.
--
-- Admins act through two paths only:
--   1. RLS "admin" policies on global config tables (plans, checklist_templates, defect_categories, app_settings).
--   2. security-definer admin_* functions that start with assert_admin() and write to admin_audit.
-- Admins never get RLS access to other users' inspections, defects, photos or reports: the admin
-- inspection list returns metadata only (product decision, 2026-11-18).

-- ---------------------------------------------------------------------------
-- Guard
-- ---------------------------------------------------------------------------
create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'SNAGIT_FORBIDDEN' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log (append-only; written by admin functions and config-table triggers)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit (
  id           bigint generated always as identity primary key,
  admin_id     uuid references public.profiles (id) on delete set null,
  action       text not null check (char_length(action) <= 60),
  target_type  text not null default '' check (char_length(target_type) <= 40),
  target_id    text not null default '' check (char_length(target_id) <= 80),
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;
drop policy if exists admin_audit_select on public.admin_audit;
create policy admin_audit_select on public.admin_audit for select to authenticated
  using ((select public.is_admin()));
-- No insert/update/delete policies: rows come only from security-definer code below.
revoke insert, update, delete on public.admin_audit from anon, authenticated;

create or replace function public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into admin_audit (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, coalesce(p_target_type, ''), coalesce(p_target_id, ''), coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon, authenticated;

-- Row trigger for admin-edited config tables. Skips writes made outside a user session (migrations, seeds).
create or replace function public.audit_config_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_key text := coalesce(v_new ->> 'id', v_new ->> 'key', v_old ->> 'id', v_old ->> 'key', '');
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'updated_by') and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  else
    v_changes := coalesce(v_new, v_old);
  end if;
  insert into admin_audit (admin_id, action, target_type, target_id, details)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_key, v_changes);
  return null;
end $$;

drop trigger if exists plans_audit on public.plans;
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function public.audit_config_change();
drop trigger if exists checklist_templates_audit on public.checklist_templates;
create trigger checklist_templates_audit after insert or update or delete on public.checklist_templates
  for each row execute function public.audit_config_change();

-- ---------------------------------------------------------------------------
-- Plans: admins edit prices, names, limits and visibility. The three plan ids are fixed in code.
-- ---------------------------------------------------------------------------
revoke insert, delete on public.plans from anon, authenticated;
do $$ begin
  alter table public.plans add constraint plans_price_sane
    check ((id = 'free' and price_cents = 0) or (id <> 'free' and price_cents between 100 and 100000000));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.plans add constraint plans_free_always_active check (id <> 'free' or is_active);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Defect categories (global, admin-managed). Defects and checklist items store the key as text,
-- so hiding a category never breaks old rows; keys are permanent, names are editable.
-- ---------------------------------------------------------------------------
create table if not exists public.defect_categories (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name_en     text not null check (char_length(name_en) between 1 and 60),
  name_ar     text not null check (char_length(name_ar) between 1 and 60),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.defect_categories (key, name_en, name_ar, sort_order) values
  ('architectural', 'Architectural', 'معماري', 10),
  ('electrical',    'Electrical',    'كهرباء', 20),
  ('plumbing',      'Plumbing',      'صحي',    30),
  ('mechanical',    'Mechanical',    'ميكانيكا', 40)
on conflict (key) do nothing;

drop trigger if exists defect_categories_touch on public.defect_categories;
create trigger defect_categories_touch before update on public.defect_categories
  for each row execute function public.touch_updated_at();
drop trigger if exists defect_categories_audit on public.defect_categories;
create trigger defect_categories_audit after insert or update or delete on public.defect_categories
  for each row execute function public.audit_config_change();

alter table public.defect_categories enable row level security;
drop policy if exists defect_categories_read on public.defect_categories;
create policy defect_categories_read on public.defect_categories for select to anon, authenticated using (true);
drop policy if exists defect_categories_admin on public.defect_categories;
create policy defect_categories_admin on public.defect_categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke delete on public.defect_categories from anon, authenticated;
grant select on public.defect_categories to anon;

-- ---------------------------------------------------------------------------
-- App settings (public values only: anyone can read them. Never store secrets here.)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key check (key in ('announcement_en', 'announcement_ar', 'support_email', 'support_whatsapp', 'ai_daily_limit')),
  value       text not null default '' check (char_length(value) <= 500),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  check (key <> 'ai_daily_limit' or value ~ '^([1-9][0-9]{0,3})?$')
);

insert into public.app_settings (key, value) values
  ('announcement_en', ''), ('announcement_ar', ''), ('support_email', ''), ('support_whatsapp', ''), ('ai_daily_limit', '')
on conflict (key) do nothing;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists app_settings_audit on public.app_settings;
create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function public.audit_config_change();

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, delete on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon;

-- ---------------------------------------------------------------------------
-- Report share links. The owner creates a link to one report version; anyone with the link can
-- download that PDF until it expires or is revoked. The token is 64 hex chars (~244 random bits).
-- ---------------------------------------------------------------------------
create table if not exists public.report_shares (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique
                  default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  report_id       uuid not null references public.reports (id) on delete cascade,
  inspection_id   uuid not null references public.inspections (id) on delete cascade,
  owner_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  view_count      integer not null default 0,
  last_viewed_at  timestamptz,
  created_at      timestamptz not null default now(),
  check (token ~ '^[0-9a-f]{64}$'),
  check (expires_at > created_at and expires_at <= created_at + interval '91 days')
);
create index if not exists report_shares_inspection_idx on public.report_shares (inspection_id, created_at desc);

alter table public.report_shares enable row level security;
drop policy if exists report_shares_select on public.report_shares;
create policy report_shares_select on public.report_shares for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists report_shares_insert on public.report_shares;
create policy report_shares_insert on public.report_shares for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.reports r
                 where r.id = report_id and r.owner_id = (select auth.uid()) and r.inspection_id = report_shares.inspection_id)
  );
-- Owners may only revoke (set revoked_at), never un-revoke or extend.
drop policy if exists report_shares_revoke on public.report_shares;
create policy report_shares_revoke on public.report_shares for update to authenticated
  using (owner_id = (select auth.uid()) and revoked_at is null)
  with check (owner_id = (select auth.uid()) and revoked_at is not null);
drop policy if exists report_shares_delete on public.report_shares;
create policy report_shares_delete on public.report_shares for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.report_shares from anon;
revoke update on public.report_shares from authenticated;
grant update (revoked_at) on public.report_shares to authenticated;

-- Public (anon) lookups by token. Nothing is returned for unknown, revoked or expired links.
create or replace function public.get_report_share(p_token text)
returns table (project_name text, inspector_name text, inspection_date date, version integer, language text,
               page_count integer, byte_size integer, report_created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.project_name, i.inspector_name, i.inspection_date, r.version, r.language,
         r.page_count, r.byte_size, r.created_at, s.expires_at
    from report_shares s
    join reports r on r.id = s.report_id
    join inspections i on i.id = s.inspection_id
    join properties p on p.id = i.property_id
   where p_token ~ '^[0-9a-f]{64}$'
     and s.token = p_token and s.revoked_at is null and s.expires_at > now();
$$;

create or replace function public.open_report_share(p_token text)
returns table (storage_path text, project_name text, version integer, language text)
language plpgsql security definer set search_path = public as $$
begin
  if p_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  return query
    with s as (
      update report_shares rs
         set view_count = rs.view_count + 1, last_viewed_at = now()
       where rs.token = p_token and rs.revoked_at is null and rs.expires_at > now()
       returning rs.report_id, rs.inspection_id
    )
    select r.storage_path, p.project_name, r.version, r.language
      from s
      join reports r on r.id = s.report_id
      join inspections i on i.id = s.inspection_id
      join properties p on p.id = i.property_id;
end $$;

revoke execute on function public.get_report_share(text) from public;
revoke execute on function public.open_report_share(text) from public;
grant execute on function public.get_report_share(text) to anon, authenticated;
grant execute on function public.open_report_share(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: analytics
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  r jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'users',                 (select count(*) from profiles),
    'users_7d',              (select count(*) from profiles where created_at > now() - interval '7 days'),
    'users_30d',             (select count(*) from profiles where created_at > now() - interval '30 days'),
    'by_role',               (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*) n from profiles group by role) x),
    'pro_active',            (select count(*) from subscriptions where status = 'active' and current_period_end > now()),
    'inspections',           (select count(*) from inspections),
    'inspections_active',    (select count(*) from inspections where status in ('draft', 'in_progress')),
    'inspections_completed', (select count(*) from inspections where status = 'completed'),
    'defects',               (select count(*) from defects),
    'reports',               (select count(*) from reports),
    'reports_30d',           (select count(*) from reports where created_at > now() - interval '30 days'),
    'unlocks',               (select count(*) from inspection_unlocks),
    'payments_paid',         (select count(*) from payments where status = 'paid'),
    'payments_failed_30d',   (select count(*) from payments where status = 'failed' and created_at > now() - interval '30 days'),
    'revenue',               (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
                                from (select currency, sum(amount_cents) total from payments where status = 'paid' group by currency) x),
    'revenue_30d',           (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
                                from (select currency, sum(amount_cents) total from payments
                                       where status = 'paid' and paid_at > now() - interval '30 days' group by currency) x),
    'ai_requests_30d',       (select count(*) from ai_requests where created_at > now() - interval '30 days'),
    'shares_active',         (select count(*) from report_shares where revoked_at is null and expires_at > now()),
    'daily', (
      with days as (
        select d::date as day from generate_series(v_today - 29, v_today, interval '1 day') d
      ),
      u as (select (created_at at time zone 'Africa/Cairo')::date as day, count(*) n from profiles
             where created_at > now() - interval '31 days' group by 1),
      i as (select (created_at at time zone 'Africa/Cairo')::date as day, count(*) n from inspections
             where created_at > now() - interval '31 days' group by 1),
      d as (select (created_at at time zone 'Africa/Cairo')::date as day, count(*) n from defects
             where created_at > now() - interval '31 days' group by 1),
      rp as (select (created_at at time zone 'Africa/Cairo')::date as day, count(*) n from reports
             where created_at > now() - interval '31 days' group by 1)
      select jsonb_agg(jsonb_build_object(
               'day', days.day, 'users', coalesce(u.n, 0), 'inspections', coalesce(i.n, 0),
               'defects', coalesce(d.n, 0), 'reports', coalesce(rp.n, 0)) order by days.day)
        from days
        left join u using (day) left join i using (day) left join d using (day) left join rp using (day)
    )
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: users
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, email text, full_name text, role public.user_role, phone text, company text,
               created_at timestamptz, last_sign_in_at timestamptz, inspections integer, defects integer,
               reports integer, pro_until timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := '%' || replace(replace(replace(left(coalesce(p_search, ''), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.assert_admin();
  return query
    select p.id, u.email::text, p.full_name, p.role, p.phone, p.company, p.created_at, u.last_sign_in_at,
           (select count(*)::int from inspections x where x.owner_id = p.id),
           (select count(*)::int from defects x where x.owner_id = p.id),
           (select count(*)::int from reports x where x.owner_id = p.id),
           (select s.current_period_end from subscriptions s
             where s.user_id = p.id and s.status = 'active' and s.current_period_end > now()),
           count(*) over ()
      from profiles p
      join auth.users u on u.id = p.id
     where coalesce(p_search, '') = ''
        or u.email::text ilike v_q or p.full_name ilike v_q or coalesce(p.phone, '') ilike v_q or coalesce(p.company, '') ilike v_q
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.user_role;
begin
  perform public.assert_admin();
  if p_role not in ('individual', 'inspector', 'admin') then
    raise exception 'SNAGIT_ADMIN:invalid_role';
  end if;
  if p_user = auth.uid() then
    raise exception 'SNAGIT_ADMIN:self';
  end if;
  select role into v_old from profiles where id = p_user for update;
  if v_old is null then
    raise exception 'SNAGIT_ADMIN:not_found';
  end if;
  if v_old::text = p_role then
    return;
  end if;
  update profiles set role = p_role::public.user_role where id = p_user;
  perform public.log_admin_action('user.set_role', 'user', p_user::text, jsonb_build_object('from', v_old, 'to', p_role));
end $$;

-- Grant or extend Pro by hand (support, partners, testing). p_until is the new end of the period.
create or replace function public.admin_grant_pro(p_user uuid, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prev timestamptz;
begin
  perform public.assert_admin();
  if p_until is null or p_until <= now() or p_until > now() + interval '5 years' then
    raise exception 'SNAGIT_ADMIN:invalid_date';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    raise exception 'SNAGIT_ADMIN:not_found';
  end if;
  select current_period_end into v_prev from subscriptions where user_id = p_user;
  insert into subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  values (p_user, 'pro_annual', 'active', now(), p_until)
  on conflict (user_id) do update
    set plan_id = 'pro_annual', status = 'active', current_period_end = excluded.current_period_end,
        current_period_start = case when subscriptions.status = 'active' and subscriptions.current_period_end > now()
                                    then subscriptions.current_period_start else now() end;
  perform public.log_admin_action('user.grant_pro', 'user', p_user::text,
                                  jsonb_build_object('until', p_until, 'previous_end', v_prev));
end $$;

create or replace function public.admin_cancel_pro(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update subscriptions set status = 'canceled' where user_id = p_user and status = 'active';
  if found then
    perform public.log_admin_action('user.cancel_pro', 'user', p_user::text, '{}'::jsonb);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: inspections (metadata only, no defect text, photos or reports)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_inspections(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, project_name text, developer_name text, status public.inspection_status, inspection_date date,
               owner_id uuid, owner_email text, created_at timestamptz, updated_at timestamptz,
               defects_total integer, defects_open integer, reports integer, unlocked boolean, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := '%' || replace(replace(replace(left(coalesce(p_search, ''), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.assert_admin();
  return query
    select s.id, s.project_name, s.developer_name, s.status, s.inspection_date, s.owner_id, u.email::text,
           s.created_at, s.updated_at, s.defects_total::int, s.defects_open::int,
           (select count(*)::int from reports r where r.inspection_id = s.id),
           exists (select 1 from inspection_unlocks x where x.inspection_id = s.id),
           count(*) over ()
      from inspection_summaries s
      join auth.users u on u.id = s.owner_id
     where coalesce(p_search, '') = ''
        or s.project_name ilike v_q or s.developer_name ilike v_q or u.email::text ilike v_q
     order by s.updated_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------------------------------------------------------------------------
-- Admin: billing
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_payments(p_status text default '', p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, user_id uuid, email text, kind text, amount_cents integer, currency text, status text,
               provider_txn_id text, error text, created_at timestamptz, paid_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
    select p.id, p.user_id, u.email::text, p.kind, p.amount_cents, p.currency, p.status, p.provider_txn_id, p.error,
           p.created_at, p.paid_at, count(*) over ()
      from payments p
      join auth.users u on u.id = p.user_id
     where coalesce(p_status, '') = '' or p.status = p_status
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_list_subscriptions()
returns table (user_id uuid, email text, full_name text, plan_id text, status text,
               current_period_start timestamptz, current_period_end timestamptz, manual boolean, is_live boolean,
               updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
    select s.user_id, u.email::text, p.full_name, s.plan_id, s.status, s.current_period_start, s.current_period_end,
           s.last_payment_id is null, (s.status = 'active' and s.current_period_end > now()), s.updated_at
      from subscriptions s
      join profiles p on p.id = s.user_id
      join auth.users u on u.id = s.user_id
     order by (s.status = 'active' and s.current_period_end > now()) desc, s.current_period_end desc
     limit 500;
end $$;

create or replace function public.admin_list_audit(p_limit integer default 100)
returns table (id bigint, admin_email text, action text, target_type text, target_id text, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
    select a.id, u.email::text, a.action, a.target_type, a.target_id, a.details, a.created_at
      from admin_audit a
      left join auth.users u on u.id = a.admin_id
     order by a.created_at desc, a.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

-- Admin functions: signed-in callers only (each one still checks is_admin()).
do $$
declare f text;
begin
  foreach f in array array[
    'public.assert_admin()',
    'public.admin_stats()',
    'public.admin_list_users(text, integer, integer)',
    'public.admin_set_role(uuid, text)',
    'public.admin_grant_pro(uuid, timestamptz)',
    'public.admin_cancel_pro(uuid)',
    'public.admin_list_inspections(text, integer, integer)',
    'public.admin_list_payments(text, integer, integer)',
    'public.admin_list_subscriptions()',
    'public.admin_list_audit(integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
