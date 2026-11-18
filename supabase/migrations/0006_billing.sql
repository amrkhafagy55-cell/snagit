-- SNAGIT — Stage 6: plans, payments, entitlements and Free-plan limits
-- Run after 0001–0005. Safe to run more than once.
--
-- Limits are enforced HERE (triggers), not only in the UI, so direct API calls can't bypass them.
-- Payments and entitlements are written only by the server with the service-role key
-- (Paymob webhook after HMAC verification); users can read their own rows.

-- ---------------------------------------------------------------------------
-- Plans (prices in piasters/cents; editable by admins)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id                          text primary key check (id in ('free', 'pro_annual', 'report')),
  name_en                     text not null,
  name_ar                     text not null,
  billing                     text not null check (billing in ('free', 'annual', 'one_time')),
  price_cents                 integer not null default 0 check (price_cents >= 0),
  currency                    text not null default 'EGP',
  max_active_inspections      integer check (max_active_inspections > 0),   -- null = unlimited
  max_defects_per_inspection  integer check (max_defects_per_inspection > 0), -- null = unlimited
  is_active                   boolean not null default true,
  sort_order                  integer not null default 0,
  updated_at                  timestamptz not null default now()
);

insert into public.plans (id, name_en, name_ar, billing, price_cents, currency, max_active_inspections, max_defects_per_inspection, sort_order)
values
  ('free',       'Free',          'مجانية',     'free',     0,      'EGP', 1,   10,   10),
  ('pro_annual', 'Pro (annual)',  'Pro سنوية',  'annual',   249900, 'EGP', 100, null, 20),
  ('report',     'Single report', 'تقرير واحد', 'one_time', 39900,  'EGP', null, null, 30)
on conflict (id) do nothing;

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to anon, authenticated using (true);
drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.plans to anon;

-- ---------------------------------------------------------------------------
-- Payments (one row per checkout attempt)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  kind                   text not null check (kind in ('pro_annual', 'report')),
  inspection_id          uuid references public.inspections (id) on delete set null,
  amount_cents           integer not null check (amount_cents > 0),
  currency               text not null,
  status                 text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider               text not null default 'paymob',
  provider_intention_id  text,
  provider_order_id      text,
  provider_txn_id        text,
  error                  text,
  callback               jsonb,
  paid_at                timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create unique index if not exists payments_provider_txn_uidx on public.payments (provider, provider_txn_id) where provider_txn_id is not null;

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

alter table public.payments enable row level security;
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- No insert/update/delete policies: only the service role (server) writes payments.

-- ---------------------------------------------------------------------------
-- Subscriptions (one row per user; renewals extend current_period_end)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.profiles (id) on delete cascade,
  plan_id               text not null references public.plans (id),
  status                text not null default 'active' check (status in ('active', 'canceled')),
  current_period_start  timestamptz not null,
  current_period_end    timestamptz not null,
  last_payment_id       uuid references public.payments (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Per-inspection unlocks (pay-per-report: the whole inspection gets Pro features)
-- ---------------------------------------------------------------------------
create table if not exists public.inspection_unlocks (
  inspection_id  uuid primary key references public.inspections (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  payment_id     uuid references public.payments (id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table public.inspection_unlocks enable row level security;
drop policy if exists unlocks_select on public.inspection_unlocks;
create policy unlocks_select on public.inspection_unlocks for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Entitlement helpers
-- ---------------------------------------------------------------------------
create or replace function public.has_pro(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from subscriptions s
            where s.user_id = p_user and s.status = 'active' and s.current_period_end > now())
      or exists (select 1 from profiles p where p.id = p_user and p.role = 'admin');
$$;

-- True when the inspection has Pro features: owner is Pro/admin, or the inspection was unlocked.
-- Callers that aren't the owner always get false (no information about other users' data).
create or replace function public.inspection_unlocked(p_inspection uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from inspections i
     where i.id = p_inspection
       and (auth.uid() is null or i.owner_id = auth.uid() or public.is_admin())
       and (public.has_pro(i.owner_id)
            or exists (select 1 from inspection_unlocks u where u.inspection_id = i.id))
  );
$$;

create or replace function public.limits_for(p_user uuid)
returns public.plans language sql stable security definer set search_path = public as $$
  select * from plans where id = case when public.has_pro(p_user) then 'pro_annual' else 'free' end;
$$;

-- What the signed-in user can do (for the UI; enforcement is in the triggers below).
create or replace function public.my_entitlements()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pro', public.has_pro(auth.uid()),
    'pro_until', (select current_period_end from subscriptions
                   where user_id = auth.uid() and status = 'active' and current_period_end > now()),
    'max_active_inspections', (public.limits_for(auth.uid())).max_active_inspections,
    'max_defects_per_inspection', (select max_defects_per_inspection from plans where id = 'free'),
    'active_inspections', (select count(*) from inspections
                            where owner_id = auth.uid() and status in ('draft', 'in_progress'))
  );
$$;

grant execute on function public.has_pro(uuid) to authenticated;
grant execute on function public.inspection_unlocked(uuid) to authenticated;
grant execute on function public.my_entitlements() to authenticated;

-- ---------------------------------------------------------------------------
-- Enforcement triggers. Errors use the prefix SNAGIT_LIMIT: so the app can show upgrade prompts.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_inspection_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max integer;
  v_active integer;
begin
  if new.status in ('draft', 'in_progress')
     and (tg_op = 'INSERT' or old.status not in ('draft', 'in_progress')) then
    v_max := (public.limits_for(new.owner_id)).max_active_inspections;
    if v_max is not null then
      select count(*) into v_active from inspections
       where owner_id = new.owner_id and status in ('draft', 'in_progress') and id <> new.id;
      if v_active >= v_max then
        raise exception 'SNAGIT_LIMIT:active_inspections' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists inspections_limit on public.inspections;
create trigger inspections_limit before insert or update of status on public.inspections
  for each row execute function public.enforce_inspection_limit();

create or replace function public.enforce_defect_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unlocked boolean;
  v_max integer;
  v_count integer;
begin
  -- Rows written into someone else's inspection are left for RLS to reject (no information leak).
  if not exists (select 1 from inspections i where i.id = new.inspection_id and i.owner_id = new.owner_id) then
    return new;
  end if;
  v_unlocked := public.has_pro(new.owner_id)
             or exists (select 1 from inspection_unlocks u where u.inspection_id = new.inspection_id);
  if v_unlocked then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select max_defects_per_inspection into v_max from plans where id = 'free';
    if v_max is not null then
      select count(*) into v_count from defects where inspection_id = new.inspection_id;
      if v_count >= v_max then
        raise exception 'SNAGIT_LIMIT:defects' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.plan_x is not null
     and (tg_op = 'INSERT' or old.plan_x is distinct from new.plan_x or old.plan_y is distinct from new.plan_y) then
    raise exception 'SNAGIT_LIMIT:plan' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists defects_limits on public.defects;
create trigger defects_limits before insert or update of plan_x, plan_y on public.defects
  for each row execute function public.enforce_defect_limits();

create or replace function public.enforce_after_photo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_inspection uuid;
begin
  if new.kind = 'after' then
    select inspection_id into v_inspection from defects where id = new.defect_id and owner_id = new.owner_id;
    if v_inspection is null then
      return new; -- not the writer's defect: RLS rejects it
    end if;
    if not (public.has_pro(new.owner_id)
            or exists (select 1 from inspection_unlocks u where u.inspection_id = v_inspection)) then
      raise exception 'SNAGIT_LIMIT:after_photos' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists defect_photos_after_limit on public.defect_photos;
create trigger defect_photos_after_limit before insert on public.defect_photos
  for each row execute function public.enforce_after_photo();
