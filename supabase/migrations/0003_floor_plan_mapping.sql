-- SNAGIT — Stage 3: interactive floor plan mapping
-- Run after 0001 and 0002. Safe to run more than once.

-- The image shown in the viewer (and later in PDF reports). For PNG/JPG uploads it is the
-- original file; for PDF uploads it is page 1 rendered to PNG in the browser.
alter table public.properties add column if not exists floor_plan_image_path text;
alter table public.properties add column if not exists floor_plan_width integer check (floor_plan_width between 1 and 20000);
alter table public.properties add column if not exists floor_plan_height integer check (floor_plan_height between 1 and 20000);

-- Existing image plans can be shown as-is.
update public.properties
   set floor_plan_image_path = floor_plan_path
 where floor_plan_image_path is null
   and floor_plan_mime in ('image/png', 'image/jpeg', 'image/webp');

-- A marker has both coordinates or neither (relative 0..1 of the plan image).
do $$ begin
  alter table public.defects
    add constraint defects_plan_xy_pair check ((plan_x is null) = (plan_y is null));
exception when duplicate_object then null; end $$;

-- Rendered PDF pages are PNG; make sure the bucket accepts them (it already does, kept explicit).
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
 where id = 'floor-plans';
