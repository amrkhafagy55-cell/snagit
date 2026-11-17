"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useErrorText } from "@/lib/i18n/client";
import type { ActionResult } from "@/lib/types";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";

/**
 * Runs a server action on click, with pending state, optional confirm() and an inline error.
 * Actions that redirect on success never return; others refresh the page.
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  confirmText,
  variant = "secondary",
  size = "md",
  className = "",
}: {
  action: () => Promise<ActionResult<unknown> | void>;
  children: ReactNode;
  pendingLabel?: string;
  confirmText?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errorText = useErrorText();
  const router = useRouter();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        loading={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const res = await action();
            if (res && !res.ok) setError(res.error);
            else router.refresh();
          });
        }}
      >
        {pending && pendingLabel ? pendingLabel : children}
      </Button>
      {error && <span className="text-sm text-red-600">{errorText(error)}</span>}
    </span>
  );
}
