"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { deleteAccountAction } from "../_actions/account";

/** Danger zone in Settings: type your e-mail, confirm once more, and the account is gone. */
export function DeleteAccount({ email, pro }: { email: string; pro: boolean }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const s = t.settings;
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && email !== "";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!matches || !window.confirm(s.deleteFinal)) return;
        setError(null);
        start(async () => {
          // On success the action redirects to the landing page and never returns.
          const res = await deleteAccountAction(typed);
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <p className="text-sm text-navy-700">{s.deleteBody}</p>
      <ul className="list-disc space-y-1 ps-5 text-sm text-navy-700">
        {s.deleteItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-sm text-navy-500">{s.deleteKeeps}</p>
      {pro && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {s.deletePro}{" "}
            <Link href="/refund" className="font-semibold underline">
              {t.legal.refund}
            </Link>
          </span>
        </p>
      )}
      <div>
        <label htmlFor="delete-confirm" className="field-label">
          {s.deleteConfirmLabel}
        </label>
        <input
          id="delete-confirm"
          type="email"
          dir="ltr"
          autoComplete="off"
          className="field-input"
          placeholder={email}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-describedby={error ? "delete-error" : undefined}
        />
      </div>
      {error && (
        <p id="delete-error" role="alert" className="text-sm text-red-600">
          {errorText(error)}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="danger" disabled={!matches} loading={pending}>
          <Trash2 className="size-4" aria-hidden />
          {pending ? s.deleting : s.deleteButton}
        </Button>
      </div>
    </form>
  );
}
