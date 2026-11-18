"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n";
import { updateSettingsAction } from "../../_actions/admin";

type Values = { announcement_en: string; announcement_ar: string; support_email: string; support_whatsapp: string; ai_daily_limit: string };

export function SettingsForm({ initial, aiDefault }: { initial: Values; aiDefault: number }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const err = (k: keyof Values) => (errors[k] ? errorText(errors[k]) : undefined);

  return (
    <form
      className="card space-y-5 p-5 sm:p-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await updateSettingsAction(v);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setMsg({ tone: "error", text: errorText(res.error) });
          } else {
            setErrors({});
            setMsg({ tone: "success", text: t.app.saved });
            router.refresh();
          }
        });
      }}
    >
      <Alert tone="info">{t.admin.settingsHint}</Alert>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Field label={t.admin.announcementEn} htmlFor="ann-en" hint={t.admin.announcementHint} error={err("announcement_en")}>
        <textarea id="ann-en" rows={2} maxLength={300} className="field-input h-auto py-2" value={v.announcement_en} onChange={set("announcement_en")} />
      </Field>
      <Field label={t.admin.announcementAr} htmlFor="ann-ar" hint={t.admin.announcementHint} error={err("announcement_ar")}>
        <textarea id="ann-ar" dir="rtl" rows={2} maxLength={300} className="field-input h-auto py-2" value={v.announcement_ar} onChange={set("announcement_ar")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.admin.supportEmail} htmlFor="sup-email" hint={t.admin.supportHint} error={err("support_email") && t.errors.invalidEmail}>
          <input id="sup-email" type="email" dir="ltr" maxLength={200} className="field-input" value={v.support_email} onChange={set("support_email")} />
        </Field>
        <Field label={t.admin.supportWhatsapp} htmlFor="sup-wa" hint={t.admin.supportHint} error={err("support_whatsapp") && t.errors.phone}>
          <input id="sup-wa" type="tel" dir="ltr" maxLength={16} placeholder="+201012345678" className="field-input" value={v.support_whatsapp} onChange={set("support_whatsapp")} />
        </Field>
      </div>
      <Field label={t.admin.aiDailyLimit} htmlFor="ai-limit" hint={fill(t.admin.aiDailyLimitHint, { n: aiDefault })} error={err("ai_daily_limit")}>
        <input id="ai-limit" inputMode="numeric" dir="ltr" maxLength={4} className="field-input w-32" value={v.ai_daily_limit} onChange={set("ai_daily_limit")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t.app.save}
        </Button>
      </div>
    </form>
  );
}
