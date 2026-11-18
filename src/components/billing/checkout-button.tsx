"use client";
import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { startCheckoutAction } from "@/app/(app)/_actions/billing";

/** Collects a phone number (Paymob requires it) and sends the user to Paymob's hosted checkout. */
export function CheckoutButton({
  kind,
  inspectionId = null,
  defaultPhone,
  label,
  testMode,
  variant = "accent",
}: {
  kind: "pro_annual" | "report";
  inspectionId?: string | null;
  defaultPhone: string;
  label: string;
  testMode: boolean;
  variant?: "accent" | "primary" | "secondary";
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant={variant} className="w-full" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setFieldError(null);
        start(async () => {
          const res = await startCheckoutAction({ kind, inspectionId, phone });
          if (!res.ok) {
            if (res.fieldErrors?.phone) setFieldError(res.fieldErrors.phone);
            else setError(res.error);
            return;
          }
          window.location.assign(res.data.url);
        });
      }}
    >
      <Field label={t.billing.phone} htmlFor={`phone-${kind}`} error={fieldError ? errorText(fieldError) : undefined}>
        <input
          id={`phone-${kind}`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          className="field-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01012345678"
          required
          aria-invalid={Boolean(fieldError)}
        />
      </Field>
      {error && <Alert>{errorText(error)}</Alert>}
      {testMode && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t.billing.testMode}</p>}
      <Button type="submit" variant={variant} className="w-full" loading={pending}>
        {!pending && <Lock className="size-4" aria-hidden />}
        {pending ? t.billing.redirecting : t.billing.pay}
      </Button>
    </form>
  );
}
