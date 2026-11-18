import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { fill, formatNumber } from "@/lib/i18n";
import { formatPrice } from "@/lib/billing";
import { Alert } from "@/components/ui";
import { SectionTitle, StatTile } from "@/components/admin/admin-ui";
import { DailyBars } from "@/components/admin/daily-bars";
import type { UserRole } from "@/lib/types";

type Stats = {
  users: number;
  users_7d: number;
  by_role: Partial<Record<UserRole, number>>;
  pro_active: number;
  inspections: number;
  inspections_active: number;
  inspections_completed: number;
  defects: number;
  reports: number;
  reports_30d: number;
  unlocks: number;
  payments_paid: number;
  payments_failed_30d: number;
  revenue: Record<string, number>;
  revenue_30d: Record<string, number>;
  ai_requests_30d: number;
  shares_active: number;
  daily: { day: string; users: number; inspections: number; defects: number; reports: number }[];
};

export default async function AdminOverviewPage() {
  const [{ t, lang }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data, error } = await supabase.rpc("admin_stats");
  if (error || !data) {
    console.error("[admin] stats", error?.message);
    return <Alert>{t.errors.pageError}</Alert>;
  }
  const s = data as Stats;
  const n = (v: number) => formatNumber(v, lang);
  const money = (m: Record<string, number>) =>
    Object.keys(m).length ? Object.entries(m).map(([cur, cents]) => formatPrice(cents, cur, lang)).join(" + ") : formatPrice(0, "EGP", lang);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label={t.admin.users} value={n(s.users)} sub={`+${n(s.users_7d)} ${t.admin.newUsers7d}`} />
        <StatTile label={t.admin.proActive} value={n(s.pro_active)} sub={`${t.admin.unlocks}: ${n(s.unlocks)}`} />
        <StatTile
          label={t.admin.inspections}
          value={n(s.inspections)}
          sub={fill(t.admin.activeCompleted, { a: n(s.inspections_active), c: n(s.inspections_completed) })}
        />
        <StatTile label={t.admin.defects} value={n(s.defects)} />
        <StatTile label={t.admin.reports} value={n(s.reports)} sub={fill(t.admin.reports30d, { n: n(s.reports_30d) })} />
        <StatTile label={t.admin.revenue} value={money(s.revenue)} sub={fill(t.admin.revenue30d, { v: money(s.revenue_30d) })} />
        <StatTile
          label={t.admin.payments}
          value={n(s.payments_paid)}
          sub={fill(t.admin.paymentsLine, { p: n(s.payments_paid), f: n(s.payments_failed_30d) })}
        />
        <StatTile label={t.admin.activeShares} value={n(s.shares_active)} sub={`${t.admin.aiRequests30d}: ${n(s.ai_requests_30d)}`} />
      </section>

      <section>
        <SectionTitle>{t.admin.last30}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <DailyBars title={t.admin.chartUsers} points={s.daily.map((d) => ({ day: d.day, value: d.users }))} t={t} lang={lang} />
          <DailyBars title={t.admin.chartInspections} points={s.daily.map((d) => ({ day: d.day, value: d.inspections }))} t={t} lang={lang} />
          <DailyBars title={t.admin.chartReports} points={s.daily.map((d) => ({ day: d.day, value: d.reports }))} t={t} lang={lang} />
        </div>
      </section>

      <section>
        <SectionTitle>{t.admin.byRole}</SectionTitle>
        <div className="card divide-y divide-navy-100">
          {(["individual", "inspector", "admin"] as const).map((role) => {
            const count = s.by_role[role] ?? 0;
            const pct = s.users ? Math.round((count / s.users) * 100) : 0;
            return (
              <div key={role} className="flex items-center gap-4 px-4 py-3">
                <span className="w-40 shrink-0 text-sm text-navy-700">{role === "admin" ? t.settings.admin : t.auth[role]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50">
                  <div className="h-full rounded-full bg-navy-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-end text-sm font-semibold text-navy-900">{n(count)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
