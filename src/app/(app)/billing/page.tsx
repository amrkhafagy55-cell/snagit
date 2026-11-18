import type { Metadata } from "next";
import { Check, Crown } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { getProfile } from "@/lib/auth";
import { formatPrice, getEntitlements, getPlans } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { isPaymentsEnabled, isPaymobTestMode } from "@/lib/payments/paymob";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plan & billing" };

type PaymentRow = { id: string; kind: "pro_annual" | "report"; amount_cents: number; currency: string; status: "pending" | "paid" | "failed"; created_at: string };

export default async function BillingPage() {
  const [{ t, lang }, ent, plans, profile, supabase] = await Promise.all([
    getI18n(),
    getEntitlements(),
    getPlans(),
    getProfile(),
    createClient(),
  ]);
  const { data } = await supabase
    .from("payments")
    .select("id, kind, amount_cents, currency, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const payments = (data ?? []) as PaymentRow[];
  const enabled = isPaymentsEnabled();
  const testMode = isPaymobTestMode();
  const b = t.billing;
  const plan = (id: string) => plans.find((p) => p.id === id);
  const pro = plan("pro_annual");
  const report = plan("report");
  const statusText = { paid: b.statusPaid, pending: b.statusPending, failed: b.statusFailed };
  const statusTone = { paid: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-800", failed: "bg-red-50 text-red-700" };

  return (
    <div className="space-y-8">
      <PageHeader title={b.title} subtitle={b.subtitle} />

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-navy-500">{b.currentPlan}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xl font-bold text-navy-950">
            {ent.pro && <Crown className="size-5 text-accent-500" aria-hidden />}
            {ent.pro ? b.pro : b.free}
          </p>
          {ent.pro && ent.proUntil && (
            <p className="text-sm text-navy-500">
              {b.proUntil} {formatDate(ent.proUntil, lang)}
            </p>
          )}
        </div>
        <div className="text-end">
          <p className="text-sm text-navy-500">{b.usage}</p>
          <p className="text-xl font-bold tabular-nums text-navy-950">
            {formatNumber(ent.activeInspections, lang)} / {ent.maxActiveInspections ? formatNumber(ent.maxActiveInspections, lang) : b.unlimited}
          </p>
        </div>
      </section>

      {!enabled && <p className="rounded-xl bg-navy-50 px-4 py-3 text-sm text-navy-600">{b.notEnabled}</p>}

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Free */}
        <div className="card flex flex-col p-6">
          <h2 className="text-lg font-bold text-navy-900">{b.free}</h2>
          <p className="mt-2 text-3xl font-extrabold text-navy-950">{formatPrice(0, "EGP", lang)}</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm text-navy-700">
            {b.freeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {!ent.pro && <p className="mt-6 rounded-xl bg-navy-50 py-2.5 text-center text-sm font-semibold text-navy-600">{b.current}</p>}
        </div>

        {/* Pro */}
        {pro && (
          <div className="card relative flex flex-col border-2 border-accent-400 p-6 shadow-lg shadow-accent-500/10">
            <span className="absolute -top-3 start-6 rounded-full bg-accent-500 px-3 py-0.5 text-xs font-bold text-white">PRO</span>
            <h2 className="text-lg font-bold text-navy-900">{lang === "ar" ? pro.name_ar : pro.name_en}</h2>
            <p className="mt-2 text-3xl font-extrabold text-navy-950">
              {formatPrice(pro.price_cents, pro.currency, lang)}
              <span className="ms-1 text-base font-medium text-navy-500">{b.perYear}</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-navy-700">
              {b.proFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {enabled ? (
                <CheckoutButton
                  kind="pro_annual"
                  defaultPhone={profile?.phone ?? ""}
                  label={ent.pro ? b.renew : b.upgrade}
                  testMode={testMode}
                />
              ) : ent.pro ? (
                <p className="rounded-xl bg-accent-50 py-2.5 text-center text-sm font-semibold text-accent-700">{b.current}</p>
              ) : null}
            </div>
          </div>
        )}

        {/* Single report */}
        {report && (
          <div className="card flex flex-col p-6">
            <h2 className="text-lg font-bold text-navy-900">{lang === "ar" ? report.name_ar : report.name_en}</h2>
            <p className="mt-2 text-3xl font-extrabold text-navy-950">
              {formatPrice(report.price_cents, report.currency, lang)}
              <span className="ms-1 text-base font-medium text-navy-500">{b.oneTime}</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-navy-700">
              {b.reportFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-navy-500">{b.reportHow}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-navy-900">{b.history}</h2>
        {payments.length === 0 ? (
          <p className="card p-6 text-center text-navy-500">{b.noPayments}</p>
        ) : (
          <ul className="card divide-y divide-navy-50">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-semibold text-navy-900">{p.kind === "pro_annual" ? b.kindPro : b.kindReport}</p>
                  <p className="text-navy-500">{formatDate(p.created_at, lang)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums text-navy-900">{formatPrice(p.amount_cents, p.currency, lang)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[p.status]}`}>{statusText[p.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
