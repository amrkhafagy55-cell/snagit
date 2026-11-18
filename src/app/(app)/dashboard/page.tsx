import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, Calendar, CheckCircle2, ClipboardList, MapPin, Plus, Sparkles, Bug, Activity } from "lucide-react";
import { EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { InspectionStatusBadge } from "@/components/badges";
import { ActionButton } from "@/components/action-buttons";
import { getProfile } from "@/lib/auth";
import { completion, getInspectionSummaries } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { loadSampleProjectAction } from "../_actions/sample";
import { getEntitlements } from "@/lib/billing";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [{ t, lang }, profile, summaries, ent] = await Promise.all([getI18n(), getProfile(), getInspectionSummaries(), getEntitlements()]);

  const active = summaries.filter((s) => s.status === "in_progress" || s.status === "draft").length;
  const completed = summaries.filter((s) => s.status === "completed").length;
  const defects = summaries.reduce((n, s) => n + s.defects_total, 0);
  const severe = summaries.reduce((n, s) => n + s.defects_critical + s.defects_high, 0);

  const stats = [
    { label: t.dashboard.statTotal, value: summaries.length, icon: ClipboardList, tone: "bg-navy-900 text-white" },
    { label: t.dashboard.statActive, value: active, icon: Activity, tone: "bg-accent-50 text-accent-600" },
    { label: t.dashboard.statCompleted, value: completed, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
    { label: t.dashboard.statDefects, value: defects, icon: Bug, tone: "bg-navy-50 text-navy-600" },
    { label: t.dashboard.statCritical, value: severe, icon: AlertTriangle, tone: "bg-red-50 text-red-600" },
  ];

  const firstName = (profile?.full_name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${t.dashboard.greeting} ${firstName}` : t.dashboard.title}
        subtitle={t.dashboard.subtitle}
        actions={
          <>
          <LinkButton href="/billing" variant="secondary" size="lg">
            {ent.pro ? "Pro" : `${t.billing.free} · ${t.billing.upgrade}`}
          </LinkButton>
          <LinkButton href="/properties/new" variant="accent" size="lg">
            <Plus className="size-5" aria-hidden />
            {t.dashboard.startNew}
          </LinkButton>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" aria-label={t.dashboard.title}>
        {stats.map(({ label, value, icon: Icon, tone }, i) => (
          <div key={label} className={`card p-4 sm:p-5 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
            <div className={`grid size-10 place-items-center rounded-xl ${tone}`}>
              <Icon className="size-5" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-navy-950">{formatNumber(value, lang)}</p>
            <p className="text-sm text-navy-500">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-navy-900">{t.dashboard.recent}</h2>
        {summaries.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-7" />}
            title={t.dashboard.emptyTitle}
            body={t.dashboard.emptyBody}
            action={
              <>
                <LinkButton href="/properties/new" variant="accent">
                  <Plus className="size-4" aria-hidden />
                  {t.dashboard.startNew}
                </LinkButton>
                <ActionButton action={loadSampleProjectAction} pendingLabel={t.dashboard.loadingSample}>
                  <Sparkles className="size-4" aria-hidden />
                  {t.dashboard.loadSample}
                </ActionButton>
              </>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => {
              const pct = completion(s);
              const unit = [
                s.building_number && `${t.property.building} ${s.building_number}`,
                s.apartment_number && `${t.property.apt} ${s.apartment_number}`,
                s.floor_number && `${t.property.floor} ${s.floor_number}`,
              ].filter(Boolean).join(" · ");
              return (
                <Link
                  key={s.id}
                  href={`/inspections/${s.id}`}
                  className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lg hover:shadow-navy-900/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-navy-950 group-hover:text-navy-700">{s.project_name}</h3>
                      <p className="truncate text-sm text-navy-500">{unit || t.propertyTypes[s.property_type]}</p>
                    </div>
                    <InspectionStatusBadge status={s.status} t={t} />
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm text-navy-500">
                    {s.address && (
                      <p className="flex items-center gap-2 truncate">
                        <MapPin className="size-4 shrink-0 text-navy-300" aria-hidden />
                        <span className="truncate">{s.address}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Calendar className="size-4 shrink-0 text-navy-300" aria-hidden />
                      {formatDate(s.inspection_date, lang)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Bug className="size-4 shrink-0 text-navy-300" aria-hidden />
                      {formatNumber(s.defects_total, lang)} {t.dashboard.defects}
                      {s.defects_open > 0 && (
                        <span className="text-navy-400">
                          ({formatNumber(s.defects_open, lang)} {t.dashboard.openDefects})
                        </span>
                      )}
                      {s.defects_critical > 0 && (
                        <span className="ms-auto rounded-full bg-red-50 px-2 text-xs font-semibold text-red-700">
                          {formatNumber(s.defects_critical, lang)} {t.severity.critical}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="mb-1.5 flex justify-between text-xs font-medium text-navy-500">
                      <span>{t.workspace.progress}</span>
                      <span>
                        {formatNumber(pct, lang)}% {t.dashboard.complete}
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
