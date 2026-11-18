import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { Alert } from "@/components/ui";
import { AdminTable, SectionTitle, Td } from "@/components/admin/admin-ui";
import type { Lang } from "@/lib/types";

type Row = { id: number; admin_email: string | null; action: string; target_type: string; target_id: string; details: Record<string, unknown>; created_at: string };

function when(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date(value));
}

/** Compact, readable diff: {"price_cents":[249900,199900]} → "price_cents: 249900 → 199900". */
function describe(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([k]) => !["id", "created_at", "updated_at", "updated_by"].includes(k))
    .slice(0, 6)
    .map(([k, v]) => (Array.isArray(v) && v.length === 2 ? `${k}: ${fmt(v[0])} → ${fmt(v[1])}` : `${k}: ${fmt(v)}`))
    .join(" · ");
}
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

export default async function AdminActivityPage() {
  const [{ t, lang }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data, error } = await supabase.rpc("admin_list_audit", { p_limit: 200 });
  const rows = (data ?? []) as Row[];
  const actions = t.admin.actions as Record<string, string>;
  return (
    <>
      <SectionTitle hint={t.admin.activityHint}>{t.admin.tabs.activity}</SectionTitle>
      {error ? (
        <Alert>{t.errors.pageError}</Alert>
      ) : rows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-navy-500">{t.admin.noActivity}</p>
      ) : (
        <AdminTable head={[t.admin.when, t.admin.who, t.admin.action, t.admin.details]} minWidth={820}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-navy-500">{when(r.created_at, lang)}</Td>
              <Td>
                <span dir="ltr" className="break-all">{r.admin_email ?? "—"}</span>
              </Td>
              <Td>
                <p className="font-medium text-navy-900">{actions[r.action] ?? r.action}</p>
                <p dir="ltr" className="text-start text-xs text-navy-400">
                  {r.target_type}
                  {r.target_id ? ` · ${r.target_id}` : ""}
                </p>
              </Td>
              <Td>
                <p dir="ltr" className="break-words text-start text-xs text-navy-600">{describe(r.details ?? {})}</p>
              </Td>
            </tr>
          ))}
        </AdminTable>
      )}
    </>
  );
}
