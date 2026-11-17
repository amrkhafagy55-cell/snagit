"use client";
import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { saveRemarksAction } from "../../../_actions/inspections";

/** General remarks for the final report. Saves on blur. */
export function RemarksEditor({ inspectionId, initial }: { inspectionId: string; initial: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const lastSaved = useRef(initial);

  function save() {
    if (value === lastSaved.current) return;
    start(async () => {
      const res = await saveRemarksAction(inspectionId, value);
      if (res.ok) {
        lastSaved.current = value;
        setState("saved");
      } else {
        setError(res.error);
        setState("error");
      }
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <label htmlFor="remarks" className="font-semibold text-navy-900">
          {t.workspace.remarks}
        </label>
        <span className="text-xs text-navy-400" aria-live="polite">
          {pending ? t.app.saving : state === "saved" ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check className="size-3.5" /> {t.app.saved}
            </span>
          ) : state === "error" ? (
            <span className="text-red-600">{errorText(error)}</span>
          ) : null}
        </span>
      </div>
      <textarea
        id="remarks"
        rows={4}
        maxLength={8000}
        className="field-input mt-3"
        placeholder={t.workspace.remarksHint}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
      />
    </section>
  );
}
