"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { cancelProAction, grantProAction, setUserRoleAction } from "../../_actions/admin";
import { USER_ROLES, type UserRole } from "@/lib/types";

export function RoleSelect({ userId, role, self }: { userId: string; role: UserRole; self: boolean }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = (r: UserRole) => (r === "admin" ? t.settings.admin : t.auth[r]);
  return (
    <div>
      <select
        aria-label={t.admin.role}
        className="field-input h-9 py-0 text-sm"
        value={role}
        disabled={self || pending}
        onChange={(e) => {
          const next = e.target.value as UserRole;
          setError(null);
          start(async () => {
            const res = await setUserRoleAction(userId, next);
            if (!res.ok) setError(res.error);
            router.refresh();
          });
        }}
      >
        {USER_ROLES.map((r) => (
          <option key={r} value={r}>
            {label(r)}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{errorText(error)}</p>}
    </div>
  );
}

/** Grant / extend / end Pro by hand. `defaultDate` is one year from today (Cairo). */
export function ProControl({ userId, proUntil, defaultDate, minDate }: { userId: string; proUntil: string | null; defaultDate: string; minDate: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(proUntil ? proUntil.slice(0, 10) : defaultDate);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "generic");
      else setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-1.5">
      {!open ? (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={proUntil ? "secondary" : "accent"} onClick={() => setOpen(true)}>
            {proUntil ? t.admin.changeEnd : t.admin.grantPro}
          </Button>
          {proUntil && (
            <Button
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() => {
                if (window.confirm(t.admin.endProConfirm)) run(() => cancelProAction(userId));
              }}
            >
              {t.admin.endPro}
            </Button>
          )}
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => grantProAction(userId, date));
          }}
        >
          <label className="sr-only" htmlFor={`pro-${userId}`}>
            {t.admin.endDate}
          </label>
          <input
            id={`pro-${userId}`}
            type="date"
            dir="ltr"
            required
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field-input h-9 w-40 py-0 text-sm"
          />
          <Button size="sm" type="submit" variant="primary" loading={pending}>
            {t.app.save}
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t.app.cancel}
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{errorText(error)}</p>}
    </div>
  );
}
