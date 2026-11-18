"use client";
import { useState, useTransition } from "react";
import { AlertTriangle, Check, Sparkles, Wand2, X } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { SeverityBadge } from "@/components/badges";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { categoryLabel } from "@/lib/i18n";
import { useCategories } from "@/components/category-provider";
import { photoForAi } from "@/lib/photos";
import type { DefectSuggestion } from "@/lib/ai/defect-assistant";
import type { Lang, Severity } from "@/lib/types";
import { aiSuggestAction } from "../../../_actions/ai";

type Field = "title" | "category" | "severity" | "description" | "recommendedAction";
export type AiContext = {
  title: string;
  description: string;
  category: string;
  severity: Severity;
  room: string;
  locationNote: string;
  recommendedAction: string;
};

/**
 * Optional AI helper inside the defect form. It only fills form fields when the user presses
 * "Use"; saving the defect is always a separate, human action.
 */
export function AiAssistant({
  inspectionId,
  defectId,
  newPhotos,
  storedPhotoCount,
  context,
  onApply,
}: {
  inspectionId: string;
  defectId?: string;
  newPhotos: File[];
  storedPhotoCount: number;
  context: AiContext;
  onApply: (field: Field, value: string) => void;
}) {
  const { t, lang: uiLang } = useI18n();
  const { labels } = useCategories();
  const errorText = useErrorText();
  const [lang, setLang] = useState<Lang>(uiLang);
  const [result, setResult] = useState<DefectSuggestion | null>(null);
  const [used, setUsed] = useState<Set<Field>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const photoCount = newPhotos.length || storedPhotoCount;

  function run(mode: "analyze" | "improve") {
    setError(null);
    start(async () => {
      try {
        const images = await Promise.all(newPhotos.slice(0, 3).map(photoForAi));
        const res = await aiSuggestAction({
          inspectionId,
          defectId: defectId ?? null,
          mode,
          lang,
          images,
          context,
        });
        if (!res.ok) return setError(res.error);
        setResult(res.data);
        setUsed(new Set());
      } catch {
        setError("aiUnavailable");
      }
    });
  }

  function apply(field: Field, value: string) {
    onApply(field, value);
    setUsed((s) => new Set(s).add(field));
  }

  const rows: { field: Field; label: string; value: string; display?: React.ReactNode }[] = result
    ? ([
        { field: "title", label: t.defect.title, value: result.title },
        result.category !== "other"
          ? { field: "category", label: t.defect.category, value: result.category, display: categoryLabel(result.category, t, labels) }
          : null,
        {
          field: "severity",
          label: t.defect.severity,
          value: result.severity,
          display: (
            <span className="flex flex-col gap-1">
              <SeverityBadge severity={result.severity} t={t} />
              <span className="text-xs text-navy-500">{result.severity_reason}</span>
            </span>
          ),
        },
        { field: "description", label: t.defect.description, value: result.description },
        { field: "recommendedAction", label: t.defect.action, value: result.recommended_action },
      ].filter(Boolean) as { field: Field; label: string; value: string; display?: React.ReactNode }[])
    : [];

  return (
    <section className="card overflow-hidden border-violet-200">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-violet-50 to-white px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-navy-900">
          <Sparkles className="size-5 text-violet-600" aria-hidden />
          {t.ai.title}
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">{t.ai.badge}</span>
        </h2>
        <label className="flex items-center gap-2 text-xs text-navy-500">
          {t.ai.language}
          <select
            className="rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs text-navy-800"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            disabled={pending}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm text-navy-600">{t.ai.intro}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => run("analyze")} loading={pending} disabled={photoCount === 0}>
            {!pending && <Sparkles className="size-4 text-violet-600" aria-hidden />}
            {pending ? t.ai.working : t.ai.analyze}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => run("improve")}
            disabled={pending || (!context.title.trim() && !context.description.trim())}
          >
            <Wand2 className="size-4 text-violet-600" aria-hidden />
            {t.ai.improve}
          </Button>
        </div>
        {photoCount === 0 && <p className="text-xs text-navy-400">{t.errors.aiNoPhotos}</p>}
        {error && <Alert>{errorText(error)}</Alert>}

        {result && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/40" aria-live="polite">
            <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-4 py-3">
              <div>
                <p className="font-semibold text-violet-800">{t.ai.resultTitle}</p>
                <p className="mt-0.5 text-xs text-navy-600">{t.ai.resultNote}</p>
                <p className="mt-1 text-xs text-navy-500">
                  {t.ai.confidence}: <strong>{t.ai.confidenceLevels[result.confidence]}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setResult(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-navy-400 hover:bg-white" aria-label={t.ai.dismiss}>
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              {!result.defect_visible && <Alert tone="info">{t.ai.noDefect}</Alert>}

              {result.serious_flags.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    {t.ai.serious}
                  </p>
                  <ul className="mt-1.5 list-disc space-y-0.5 ps-6">
                    {result.serious_flags.map((f) => (
                      <li key={f} dir="auto">{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="divide-y divide-violet-100 rounded-xl bg-white ring-1 ring-violet-100">
                {rows.map((r) => (
                  <li key={r.field} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-navy-500">{r.label}</p>
                      <div className="mt-0.5 whitespace-pre-line text-sm text-navy-900" dir="auto">
                        {r.display ?? r.value}
                      </div>
                    </div>
                    <Button type="button" variant={used.has(r.field) ? "ghost" : "secondary"} size="sm" onClick={() => apply(r.field, r.value)}>
                      {used.has(r.field) ? <Check className="size-4 text-emerald-600" aria-hidden /> : null}
                      {used.has(r.field) ? t.ai.used : t.ai.use}
                    </Button>
                  </li>
                ))}
              </ul>

              {result.possible_causes.length > 0 && (
                <div className="text-sm">
                  <p className="text-xs font-semibold text-navy-500">{t.ai.causes}</p>
                  <ul className="mt-1 list-disc space-y-0.5 ps-5 text-navy-700">
                    {result.possible_causes.map((c) => (
                      <li key={c} dir="auto">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.verify_on_site.length > 0 && (
                <div className="text-sm">
                  <p className="text-xs font-semibold text-navy-500">{t.ai.verify}</p>
                  <ul className="mt-1 list-disc space-y-0.5 ps-5 text-navy-700">
                    {result.verify_on_site.map((c) => (
                      <li key={c} dir="auto">{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {used.size > 0 ? <p className="text-xs text-emerald-700">{t.ai.appliedNote}</p> : <span />}
                <Button type="button" variant="primary" size="sm" onClick={() => rows.forEach((r) => apply(r.field, r.value))}>
                  <Check className="size-4" aria-hidden />
                  {t.ai.useAll}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
