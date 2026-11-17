"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { discardFloorPlan, uploadFloorPlan, validateFloorPlan } from "@/lib/floor-plan";
import { FLOOR_PLAN_TYPES } from "@/lib/validation";
import { replaceFloorPlanAction } from "@/app/(app)/_actions/plan";

/** Uploads a first plan or replaces the current one (PDFs are rendered to an image first). */
export function FloorPlanUploader({
  inspectionId,
  propertyId,
  userId,
  hasPlan,
  variant = "secondary",
}: {
  inspectionId: string;
  propertyId: string;
  userId: string;
  hasPlan: boolean;
  variant?: "primary" | "accent" | "secondary";
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFile(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    const problem = validateFloorPlan(file);
    if (problem) return setError(problem);
    setError(null);
    start(async () => {
      try {
        const upload = await uploadFloorPlan(file, userId, propertyId);
        const res = await replaceFloorPlanAction({ inspectionId, ...upload });
        if (!res.ok) {
          await discardFloorPlan(upload);
          setError(res.error);
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "uploadFailed");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input
        ref={input}
        type="file"
        accept={FLOOR_PLAN_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
        aria-label={hasPlan ? t.plan.replace : t.plan.upload}
      />
      <Button
        type="button"
        variant={variant}
        size="sm"
        loading={pending}
        onClick={() => {
          if (hasPlan && !window.confirm(t.plan.replaceConfirm)) return;
          input.current?.click();
        }}
      >
        {!pending && <Upload className="size-4" aria-hidden />}
        {pending ? t.plan.preparing : hasPlan ? t.plan.replace : t.plan.upload}
      </Button>
      {error && <span className="text-sm text-red-600">{errorText(error)}</span>}
    </span>
  );
}
