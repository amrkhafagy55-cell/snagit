import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { fill, formatDate, formatNumber, todayIso } from "@/lib/i18n";
import { Alert } from "@/components/ui";
import { AdminTable, Pager, SearchForm, Td, first, pageOffset } from "@/components/admin/admin-ui";
import type { UserRole } from "@/lib/types";
import { ProControl, RoleSelect } from "./user-controls";

type Row = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  company: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  inspections: number;
  defects: number;
  reports: number;
  pro_until: string | null;
  total_count: number;
};

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const { page, offset } = pageOffset(sp.page);
  const [{ t, lang }, supabase, me] = await Promise.all([getI18n(), createClient(), getUser()]);
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: q, p_limit: 50, p_offset: offset });
  const rows = (data ?? []) as Row[];
  const total = Number(rows[0]?.total_count ?? 0);

  return (
    <>
      <SearchForm action="/admin/users" q={q} placeholder={t.admin.searchUsers} t={t} />
      {error ? (
        <Alert>{t.errors.pageError}</Alert>
      ) : rows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-navy-500">{t.admin.noResults}</p>
      ) : (
        <AdminTable head={[t.admin.email, t.admin.role, t.admin.usage, t.admin.plan, t.admin.joined]} minWidth={900}>
          {rows.map((u) => (
            <tr key={u.id}>
              <Td>
                <p dir="ltr" className="break-all text-start font-medium text-navy-900">
                  {u.email}
                  {u.id === me?.id && <span className="ms-1 text-xs font-normal text-navy-400">({t.admin.you})</span>}
                </p>
                <p className="text-navy-500">{[u.full_name, u.company, u.phone].filter(Boolean).join(" · ")}</p>
              </Td>
              <Td>
                <RoleSelect userId={u.id} role={u.role} self={u.id === me?.id} />
              </Td>
              <Td className="whitespace-nowrap text-navy-600">
                {fill(t.admin.usageLine, { i: formatNumber(u.inspections, lang), d: formatNumber(u.defects, lang), r: formatNumber(u.reports, lang) })}
              </Td>
              <Td>
                <p className="mb-1.5 text-sm font-semibold text-navy-800">
                  {u.role === "admin"
                    ? "Pro"
                    : u.pro_until
                      ? fill(t.admin.proUntil, { date: formatDate(u.pro_until, lang) })
                      : t.admin.free}
                </p>
                {u.role !== "admin" && (
                  <ProControl userId={u.id} proUntil={u.pro_until} defaultDate={todayIso(365)} minDate={todayIso(1)} />
                )}
              </Td>
              <Td className="whitespace-nowrap text-navy-500">
                <p>{formatDate(u.created_at, lang)}</p>
                <p className="text-xs">
                  {t.admin.lastSignIn}: {u.last_sign_in_at ? formatDate(u.last_sign_in_at, lang) : t.admin.never}
                </p>
              </Td>
            </tr>
          ))}
        </AdminTable>
      )}
      <Pager base="/admin/users" params={{ q }} page={page} total={total} t={t} lang={lang} />
    </>
  );
}
