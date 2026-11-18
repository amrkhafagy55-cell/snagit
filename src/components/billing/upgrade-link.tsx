"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/** Shown next to a plan-limit error (codes starting with "limit_"). */
export function UpgradeLink({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  const { t } = useI18n();
  if (!code?.startsWith("limit_")) return null;
  return (
    <Link
      href="/billing"
      className={`inline-flex items-center gap-1.5 text-sm font-semibold text-accent-600 hover:text-accent-700 ${className}`}
    >
      <Sparkles className="size-4" aria-hidden />
      {t.billing.seePlans}
    </Link>
  );
}
