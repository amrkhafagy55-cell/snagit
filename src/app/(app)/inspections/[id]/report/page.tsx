import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assertUuid } from "@/lib/data";
import { formatNumber } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { ReportGenerator } from "./report-generator";

export const metadata: Metadata = { title: "Report" };
// Rendering a PDF with headless Chromium can take a while on serverless hosts.
export const maxDuration = 60;

type ReportRow = {
  id: string;
  version: number;
  language: "en" | "ar";
  storage_path: string;
  created_at: string;
  byte_size: number | null;
  page_count: number | null;
  summary: { defects_total?: number; defects_open?: number; open_critical?: number };
};

export default async function ReportPage({ params }: PageProps<"/inspections/[id]/report">) {
  const { id } = await params;
  assertUuid(id);
  const [{ t, lang }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data } = await supabase
    .from("reports")
    .select("id, version, language, storage_path, created_at, byte_size, page_count, summary")
    .eq("inspection_id", id)
    .order("version", { ascending: false });
  const reports = (data ?? []) as ReportRow[];

  const urls = new Map<string, string>();
  if (reports.length) {
    const { data: signed } = await supabase.storage
      .from("reports")
      .createSignedUrls(reports.map((x) => x.storage_path), 3600, { download: true });
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const n = (v: number) => formatNumber(v, lang);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Cairo",
    }).format(new Date(iso));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="card p-5 sm:p-6 lg:col-span-2">
        <h2 className="text-lg font-bold text-navy-900">{t.report.generateTitle}</h2>
        <p className="mt-1 text-sm text-navy-500">{t.report.generateBody}</p>
        <ReportGenerator inspectionId={id} />
      </section>

      <section className="lg:col-span-3">
        <h2 className="mb-3 text-lg font-bold text-navy-900">{t.report.versions}</h2>
        {reports.length === 0 ? (
          <p className="card p-6 text-center text-navy-500">{t.report.noVersions}</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((rep, i) => (
              <li key={rep.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                  <FileText className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-900">
                    {t.report.version} {rep.version}
                    <span className="ms-2 rounded bg-navy-50 px-1.5 py-0.5 text-xs font-semibold text-navy-600">
                      {rep.language === "ar" ? "العربية" : "English"}
                    </span>
                    {i === 0 && <span className="ms-2 rounded bg-accent-50 px-1.5 py-0.5 text-xs font-semibold text-accent-700">{t.report.latest}</span>}
                  </p>
                  <p className="text-sm text-navy-500">
                    {when(rep.created_at)}
                    {rep.page_count ? ` · ${n(rep.page_count)} ${t.report.pages}` : ""}
                    {rep.byte_size ? ` · ${(rep.byte_size / 1024 / 1024).toFixed(1)} MB` : ""}
                  </p>
                  {rep.summary?.defects_total !== undefined && (
                    <p className="text-xs text-navy-400">
                      {n(rep.summary.defects_total)} {t.dashboard.defects} · {n(rep.summary.defects_open ?? 0)} {t.dashboard.openDefects}
                      {rep.summary.open_critical ? ` · ${n(rep.summary.open_critical)} ${t.severity.critical}` : ""}
                    </p>
                  )}
                </div>
                {urls.get(rep.storage_path) && (
                  <a
                    href={urls.get(rep.storage_path)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-900 hover:bg-navy-50"
                  >
                    <Download className="size-4" aria-hidden />
                    {t.report.download}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
