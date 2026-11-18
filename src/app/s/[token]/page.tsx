import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, LinkIcon, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { fill, formatBytes, formatDate, formatNumber } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Shared report",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Share = {
  project_name: string;
  inspector_name: string;
  inspection_date: string;
  version: number;
  language: "en" | "ar";
  page_count: number | null;
  byte_size: number | null;
  report_created_at: string;
  expires_at: string;
};

export default async function SharedReportPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const { t, lang } = await getI18n();
  let share: Share | null = null;
  if (/^[0-9a-f]{64}$/.test(token) && isSupabaseConfigured() && isAdminClientConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_report_share", { p_token: token });
    share = (Array.isArray(data) ? data[0] : null) as Share | null;
  }
  const s = t.share;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-navy-50/50">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SNAGIT">
            <Logo />
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {!share ? (
          <div className="card p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-navy-50 text-navy-500">
              <LinkIcon className="size-7" aria-hidden />
            </div>
            <h1 className="mt-4 text-xl font-bold text-navy-950">{s.gone}</h1>
            <p className="mt-1 text-navy-500">{s.goneBody}</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="bg-navy-950 px-6 py-6 text-white">
              <p className="text-sm text-navy-200">{s.publicSubtitle}</p>
              <h1 className="mt-1 text-2xl font-bold">{s.publicTitle}</h1>
              <p className="mt-1 text-lg font-semibold text-accent-400">{share.project_name}</p>
            </div>
            <dl className="grid gap-4 px-6 py-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-navy-500">{s.inspectionDate}</dt>
                <dd className="font-semibold text-navy-900">{formatDate(share.inspection_date, lang)}</dd>
              </div>
              {share.inspector_name && (
                <div>
                  <dt className="text-sm text-navy-500">{s.inspector}</dt>
                  <dd className="font-semibold text-navy-900">{share.inspector_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-navy-500">{s.report}</dt>
                <dd className="font-semibold text-navy-900">
                  {fill(s.forVersion, { v: share.version, lang: share.language === "ar" ? "العربية" : "English" })}
                </dd>
                <dd className="text-sm text-navy-500">
                  {[
                    formatDate(share.report_created_at, lang),
                    share.page_count ? `${formatNumber(share.page_count, lang)} ${t.report.pages}` : "",
                    share.byte_size ? formatBytes(share.byte_size) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-3 border-t border-navy-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm text-navy-500">
                <FileText className="size-4 shrink-0" aria-hidden />
                {fill(s.validUntil, { date: formatDate(share.expires_at, lang) })}
              </p>
              <a
                href={`/s/${token}/download`}
                rel="nofollow"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 font-semibold text-white shadow-sm hover:bg-accent-600"
              >
                <Download className="size-5" aria-hidden />
                {s.download}
              </a>
            </div>
            <p className="flex items-start gap-2 bg-navy-50/60 px-6 py-4 text-xs text-navy-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              {s.privacy}
            </p>
          </div>
        )}
        <p className="mt-8 text-center">
          <Link href="/" className="text-sm font-semibold text-accent-700 hover:underline">
            {s.cta} →
          </Link>
        </p>
      </main>
    </div>
  );
}
