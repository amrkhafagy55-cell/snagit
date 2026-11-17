"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { updateProfileAction } from "../_actions/profile";

type Values = { fullName: string; phone: string; company: string; accountType: "individual" | "inspector" };

export function ProfileForm({ email, isAdmin, initial }: { email: string; isAdmin: boolean; initial: Values }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Values, v: string) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          const res = await updateProfileAction(values);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setMessage({ tone: "error", text: errorText(res.error) });
          } else {
            setErrors({});
            setMessage({ tone: "success", text: t.app.saved });
            router.refresh();
          }
        });
      }}
      noValidate
    >
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Field label={t.settings.email} htmlFor="email">
        <input id="email" className="field-input" value={email} disabled dir="ltr" />
      </Field>
      <Field label={t.auth.fullName} htmlFor="fullName" error={errors.fullName ? errorText(errors.fullName) : undefined}>
        <input id="fullName" className="field-input" value={values.fullName} maxLength={120} onChange={(e) => set("fullName", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.settings.phone} htmlFor="phone" optional={t.app.optional} error={errors.phone ? errorText(errors.phone) : undefined}>
          <input id="phone" type="tel" dir="ltr" className="field-input" value={values.phone} maxLength={30} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={t.settings.company} htmlFor="company" optional={t.app.optional} error={errors.company ? errorText(errors.company) : undefined}>
          <input id="company" className="field-input" value={values.company} maxLength={120} onChange={(e) => set("company", e.target.value)} />
        </Field>
      </div>
      {isAdmin ? (
        <p className="text-sm text-navy-500">
          {t.settings.role}: <strong>{t.settings.admin}</strong>
        </p>
      ) : (
        <fieldset>
          <legend className="field-label">{t.settings.role}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["individual", "inspector"] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-200 p-3 text-sm has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50">
                <input type="radio" name="accountType" checked={values.accountType === v} onChange={() => set("accountType", v)} className="accent-navy-800" />
                {t.auth[v]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          {t.app.save}
        </Button>
      </div>
    </form>
  );
}
