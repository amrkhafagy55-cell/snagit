-- SNAGIT — Stage 4: PDF report versions
-- Run after 0001–0003. Safe to run more than once.

-- What the report said when it was generated (counts are frozen with the version).
alter table public.reports add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.reports add column if not exists byte_size integer check (byte_size >= 0);
alter table public.reports add column if not exists page_count integer check (page_count >= 0);

create index if not exists reports_inspection_idx on public.reports (inspection_id, version desc);

-- Versions are never edited: owners may read, add and (only) delete their own rows.
drop policy if exists reports_all on public.reports;
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid()))
  );
drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Report PDFs are written with the user's own session into "<user_id>/…" of the reports bucket.
drop policy if exists snagit_storage_insert on storage.objects;
create policy snagit_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('floor-plans', 'defect-photos', 'reports')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
