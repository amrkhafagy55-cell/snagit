import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { fill, formatDate, formatNumber } from "@/lib/i18n";
import { Alert } from "@/components/ui";
import { InspectionStatusBadge } from "@/components/badges";
import { AdminTable, Pager, SearchForm, Td, first, pageOffset } from "@/components/admin/admin-ui";
import type { InspectionStatus } from "@/lib/types";

type Row = {
  id: string;
  project_name: string;
  developer_name: string;
  status: InspectionStatus;
  inspection_date: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
  defects_total: number;
  defects_open: number;
  reports: number;
  unlocked: boolean;
  total_count: number;
};

export default async function AdminInspectionsPage({ searchParams }: PageProps<"/admin/inspections">) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const { page, offset } = pageOffset(sp.page);
  const [{ t, lang }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data, error } = await supabase.rpc("admin_list_inspections", { p_search: q, p_limit: 50, p_offset: offset });
  const rows = (data ?? []) as Row[];
  const total = Number(rows[0]?.total_count ?? 0);

  return (
    <>
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-navy-50 px-4 py-3 text-sm text-navy-700">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t.admin.privacyNote}
      </p>
      <SearchForm action="/admin/inspections" q={q} placeholder={t.admin.searchInspections} t={t} />
      {error ? (
        <Alert>{t.errors.pageError}</Alert>
      ) : rows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-navy-500">{t.admin.noResults}</p>
      ) : (
        <AdminTable head={[t.admin.project, t.admin.owner, t.admin.status, t.admin.defects, t.admin.reports, t.admin.updated]} minWidth={860}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <p className="font-medium text-navy-900">{r.project_name}</p>
                <p className="text-navy-500">
                  {[r.developer_name, formatDate(r.inspection_date, lang)].filter(Boolean).join(" · ")}
                </p>
              </Td>
              <Td>
                <span dir="ltr" className="break-all">{r.owner_email}</span>
              </Td>
              <Td>
                <InspectionStatusBadge status={r.status} t={t} />
                {r.unlocked && <p className="mt-1 text-xs font-semibold text-emerald-700">✓ {t.admin.unlocked}</p>}
              </Td>
              <Td className="whitespace-nowrap">
                {formatNumber(r.defects_total, lang)}
                <span className="ms-1 text-navy-400">({fill(t.admin.openCount, { n: formatNumber(r.defects_open, lang) })})</span>
              </Td>
              <Td>{formatNumber(r.reports, lang)}</Td>
              <Td className="whitespace-nowrap text-navy-500">
                <p>{formatDate(r.updated_at, lang)}</p>
                <p className="text-xs">
                  {t.admin.created}: {formatDate(r.created_at, lang)}
                </p>
              </Td>
            </tr>
          ))}
        </AdminTable>
      )}
      <Pager base="/admin/inspections" params={{ q }} page={page} total={total} t={t} lang={lang} />
    </>
  );
}
