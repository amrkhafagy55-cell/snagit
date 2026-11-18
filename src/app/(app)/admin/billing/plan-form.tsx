"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { updatePlanAction } from "../../_actions/admin";

export type PlanRow = {
  id: "free" | "pro_annual" | "report";
  name_en: string;
  name_ar: string;
  price_cents: number;
  currency: string;
  max_active_inspections: number | null;
  max_defects_per_inspection: number | null;
  is_active: boolean;
};

export function PlanForm({ plan }: { plan: PlanRow }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [v, setV] = useState({
    name_en: plan.name_en,
    name_ar: plan.name_ar,
    price: (plan.price_cents / 100).toFixed(plan.price_cents % 100 === 0 ? 0 : 2),
    max_active_inspections: plan.max_active_inspections?.toString() ?? "",
    max_defects_per_inspection: plan.max_defects_per_inspection?.toString() ?? "",
    is_active: plan.is_active,
  });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const free = plan.id === "free";
  const id = (k: string) => `${plan.id}-${k}`;

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await updatePlanAction({ id: plan.id, ...v });
          setMsg(res.ok ? { tone: "success", text: t.app.saved } : { tone: "error", text: errorText(res.error) });
          if (res.ok) router.refresh();
        });
      }}
      noValidate
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-navy-900">{plan.name_en}</h3>
        <code className="rounded bg-navy-50 px-2 py-0.5 text-xs text-navy-500">{plan.id}</code>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.admin.nameEn} htmlFor={id("en")}>
          <input id={id("en")} className="field-input" maxLength={60} value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        </Field>
        <Field label={t.admin.nameAr} htmlFor={id("ar")}>
          <input id={id("ar")} dir="rtl" className="field-input" maxLength={60} value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} />
        </Field>
      </div>
      <Field label={`${t.admin.price} (${plan.currency})`} htmlFor={id("price")}>
        <input
          id={id("price")}
          inputMode="decimal"
          dir="ltr"
          className="field-input"
          disabled={free}
          value={v.price}
          onChange={(e) => setV({ ...v, price: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.admin.maxActive} htmlFor={id("active")} hint={t.admin.unlimitedHint}>
          <input
            id={id("active")}
            inputMode="numeric"
            dir="ltr"
            className="field-input"
            value={v.max_active_inspections}
            onChange={(e) => setV({ ...v, max_active_inspections: e.target.value })}
          />
        </Field>
        <Field label={t.admin.maxDefects} htmlFor={id("defects")} hint={t.admin.unlimitedHint}>
          <input
            id={id("defects")}
            inputMode="numeric"
            dir="ltr"
            className="field-input"
            value={v.max_defects_per_inspection}
            onChange={(e) => setV({ ...v, max_defects_per_inspection: e.target.value })}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-navy-700">
        <input type="checkbox" className="size-4 accent-navy-800" checked={v.is_active} disabled={free} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {t.admin.offered}
      </label>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t.app.save}
        </Button>
      </div>
    </form>
  );
}
