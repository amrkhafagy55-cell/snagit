"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileDown } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import type { Lang } from "@/lib/types";
import { generateReportAction } from "../../../_actions/report";

export function ReportGenerator({ inspectionId }: { inspectionId: string }) {
  const { t, lang: uiLang } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(uiLang);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ url: string; version: number; pageCount: number } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-5 space-y-4">
      <fieldset>
        <legend className="field-label">{t.report.language}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["en", "ar"] as const).map((l) => (
            <label
              key={l}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-navy-200 p-3 text-sm font-semibold has-[:checked]:border-navy-800 has-[:checked]:bg-navy-50"
            >
              <input type="radio" name="report-lang" checked={lang === l} onChange={() => setLang(l)} className="accent-navy-800" disabled={pending} />
              {l === "ar" ? "العربية" : "English"}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Alert>{errorText(error)}</Alert>}
      {ready && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="size-5" aria-hidden />
            {t.report.ready} · {t.report.version} {ready.version}
            <span className="font-normal text-emerald-700">· {ready.pageCount} {t.report.pages}</span>
          </p>
          <a
            href={ready.url}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="size-4" aria-hidden />
            {t.report.download}
          </a>
        </div>
      )}

      <Button
        type="button"
        variant="accent"
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() => {
          setError(null);
          setReady(null);
          start(async () => {
            const res = await generateReportAction(inspectionId, lang);
            if (!res.ok) return setError(res.error);
            setReady(res.data);
            router.refresh();
          });
        }}
      >
        {!pending && <FileDown className="size-5" aria-hidden />}
        {pending ? t.report.generating : t.report.generate}
      </Button>
    </div>
  );
}
