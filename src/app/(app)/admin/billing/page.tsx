import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n";
import { formatPrice } from "@/lib/billing";
import { Alert } from "@/components/ui";
import { AdminTable, Pager, SectionTitle, Td, first, pageOffset } from "@/components/admin/admin-ui";
import { PlanForm, type PlanRow } from "./plan-form";

type Sub = {
  user_id: string;
  email: string;
  full_name: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  manual: boolean;
  is_live: boolean;
};
type Payment = {
  id: string;
  email: string;
  kind: "pro_annual" | "report";
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  provider_txn_id: string | null;
  error: string | null;
  created_at: string;
  paid_at: string | null;
  total_count: number;
};

const STATUSES = ["", "paid", "pending", "failed"] as const;

export default async function AdminBillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(first(sp.status)) ? first(sp.status) : "";
  const { page, offset } = pageOffset(sp.page);
  const [{ t, lang }, supabase] = await Promise.all([getI18n(), createClient()]);
  const [plans, subs, payments] = await Promise.all([
    supabase.from("plans").select("id, name_en, name_ar, price_cents, currency, max_active_inspections, max_defects_per_inspection, is_active").order("sort_order"),
    supabase.rpc("admin_list_subscriptions"),
    supabase.rpc("admin_list_payments", { p_status: status, p_limit: 50, p_offset: offset }),
  ]);
  const subRows = (subs.data ?? []) as Sub[];
  const payRows = (payments.data ?? []) as Payment[];
  const payTotal = Number(payRows[0]?.total_count ?? 0);
  const statusLabel = { paid: t.billing.statusPaid, pending: t.billing.statusPending, failed: t.billing.statusFailed } as const;
  const statusTone = { paid: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700" } as const;

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle hint={t.admin.plansHint}>{t.admin.plans}</SectionTitle>
        {plans.error ? (
          <Alert>{t.errors.pageError}</Alert>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {(plans.data as PlanRow[]).map((p) => (
              <PlanForm key={p.id} plan={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>{t.admin.subscriptions}</SectionTitle>
        {subs.error ? (
          <Alert>{t.errors.pageError}</Alert>
        ) : subRows.length === 0 ? (
          <p className="card px-4 py-8 text-center text-navy-500">{t.admin.noSubscriptions}</p>
        ) : (
          <AdminTable head={[t.admin.email, t.admin.plan, t.admin.period, t.admin.status]}>
            {subRows.map((s) => {
              const live = s.is_live;
              return (
                <tr key={s.user_id}>
                  <Td>
                    <p dir="ltr" className="break-all text-start font-medium text-navy-900">{s.email}</p>
                    {s.full_name && <p className="text-navy-500">{s.full_name}</p>}
                  </Td>
                  <Td>
                    Pro · <span className="text-navy-500">{s.manual ? t.admin.manual : t.admin.paidOnline}</span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(s.current_period_start, lang)} → {formatDate(s.current_period_end, lang)}
                  </Td>
                  <Td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${live ? "bg-emerald-50 text-emerald-700" : "bg-navy-50 text-navy-500"}`}>
                      {live ? t.admin.active : t.admin.ended}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </section>

      <section>
        <SectionTitle>{t.admin.payments}</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t.admin.status}>
          {STATUSES.map((s) => (
            <Link
              key={s || "all"}
              href={s ? `/admin/billing?status=${s}` : "/admin/billing"}
              aria-current={status === s ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${status === s ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"}`}
            >
              {s ? statusLabel[s] : t.admin.allStatuses}
            </Link>
          ))}
        </div>
        {payments.error ? (
          <Alert>{t.errors.pageError}</Alert>
        ) : payRows.length === 0 ? (
          <p className="card px-4 py-8 text-center text-navy-500">{t.admin.noPayments}</p>
        ) : (
          <AdminTable head={[t.admin.created, t.admin.email, t.admin.kind, t.admin.amount, t.admin.status]}>
            {payRows.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-navy-500">{formatDate(p.created_at, lang)}</Td>
                <Td>
                  <span dir="ltr" className="break-all">{p.email}</span>
                </Td>
                <Td>{p.kind === "pro_annual" ? t.billing.kindPro : t.billing.kindReport}</Td>
                <Td className="whitespace-nowrap font-semibold text-navy-900">{formatPrice(p.amount_cents, p.currency, lang)}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[p.status]}`}>{statusLabel[p.status]}</span>
                  {p.provider_txn_id && <p dir="ltr" className="mt-1 text-start text-xs text-navy-400">#{p.provider_txn_id}</p>}
                  {p.error && <p dir="ltr" className="mt-1 text-start text-xs text-red-600">{p.error}</p>}
                </Td>
              </tr>
            ))}
          </AdminTable>
        )}
        <Pager base="/admin/billing" params={{ status }} page={page} total={payTotal} t={t} lang={lang} />
      </section>
    </div>
  );
}
