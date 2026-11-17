"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-navy-950">{t.errors.pageError}</h1>
      <p className="mt-1 text-navy-500">{t.errors.generic}</p>
      <Button className="mt-6" onClick={reset}>
        {t.app.retry}
      </Button>
    </div>
  );
}
