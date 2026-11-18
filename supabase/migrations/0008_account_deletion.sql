-- SNAGIT — self-service account deletion
-- Run after 0001–0007. Safe to run more than once.
--
-- Deleting a user (auth.users) cascades to the profile and everything they own. Payment records are
-- the exception: accounting needs the amount, date and Paymob reference, so they stay, anonymised:
-- user_id becomes null and the stored Paymob callback (payer name, e-mail, phone) is wiped first.

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;

create or replace function public.anonymise_payments_on_profile_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update payments set callback = null, error = null where user_id = old.id;
  return old;
end $$;
revoke execute on function public.anonymise_payments_on_profile_delete() from public, anon, authenticated;

drop trigger if exists profiles_anonymise_payments on public.profiles;
create trigger profiles_anonymise_payments before delete on public.profiles
  for each row execute function public.anonymise_payments_on_profile_delete();

-- Admin payment list: keep payments of deleted accounts visible (e-mail shown as null).
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
      left join auth.users u on u.id = p.user_id
     where coalesce(p_status, '') = '' or p.status = p_status
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke execute on function public.admin_list_payments(text, integer, integer) from public, anon;
grant execute on function public.admin_list_payments(text, integer, integer) to authenticated;
