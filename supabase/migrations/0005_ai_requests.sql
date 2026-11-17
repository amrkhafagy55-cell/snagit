-- SNAGIT — Stage 5: AI defect assistant usage log
-- One row per AI request: enforces the per-user daily limit and feeds cost/usage analytics later.
-- Run after 0001–0004. Safe to run more than once.

create table if not exists public.ai_requests (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  inspection_id  uuid references public.inspections (id) on delete set null,
  kind           text not null check (kind in ('analyze', 'improve')),
  model          text not null default '',
  input_tokens   integer not null default 0 check (input_tokens >= 0),
  output_tokens  integer not null default 0 check (output_tokens >= 0),
  image_count    smallint not null default 0 check (image_count between 0 and 10),
  ok             boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists ai_requests_owner_idx on public.ai_requests (owner_id, created_at desc);

alter table public.ai_requests enable row level security;

-- Users read and add their own rows; nobody edits or deletes the log from the app.
drop policy if exists ai_requests_select on public.ai_requests;
create policy ai_requests_select on public.ai_requests for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists ai_requests_insert on public.ai_requests;
create policy ai_requests_insert on public.ai_requests for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (inspection_id is null
         or exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid())))
  );
