"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, Minus, Plus, Upload, X } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { formatBytes, todayIso } from "@/lib/i18n";
import { discardFloorPlan, uploadFloorPlan, type FloorPlanUpload } from "@/lib/floor-plan";
import { FLOOR_PLAN_MAX_BYTES, FLOOR_PLAN_TYPES, type CreatePropertyInput } from "@/lib/validation";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/types";
import { createPropertyAction } from "../../_actions/inspections";

type Values = Omit<CreatePropertyInput, "propertyId" | "floorPlan">;

const STEP_FIELDS: (keyof Values)[][] = [
  ["projectName", "developerName", "address"],
  ["propertyType", "buildingNumber", "apartmentNumber", "floorNumber", "bedrooms", "bathrooms", "balconies", "hasRoof"],
  ["inspectionDate", "ownerName", "inspectorName", "notes"],
  [],
];

export function PropertyWizard({
  userId,
  defaultInspector,
  defaultOwner,
}: {
  userId: string;
  defaultInspector: string;
  defaultOwner: string;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({
    projectName: "",
    developerName: "",
    address: "",
    buildingNumber: "",
    apartmentNumber: "",
    floorNumber: "",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    balconies: 1,
    hasRoof: false,
    inspectionDate: todayIso(),
    ownerName: defaultOwner,
    inspectorName: defaultInspector,
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const steps = [t.property.step1, t.property.step2, t.property.step3, t.property.step4];

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  function stepErrors(i: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (i === 0 && !values.projectName.trim()) e.projectName = "required";
    if (i === 2 && !/^\d{4}-\d{2}-\d{2}$/.test(values.inspectionDate)) e.inspectionDate = "required";
    return e;
  }

  function validateStep(i: number): boolean {
    const e = stepErrors(i);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function pickFile(f: File | undefined) {
    setErrors((e) => ({ ...e, floorPlan: "" }));
    if (!f) return setFile(null);
    if (!(FLOOR_PLAN_TYPES as readonly string[]).includes(f.type)) return setErrors((e) => ({ ...e, floorPlan: "fileType" }));
    if (f.size > FLOOR_PLAN_MAX_BYTES) return setErrors((e) => ({ ...e, floorPlan: "fileTooBig" }));
    setFile(f);
  }

  const roomsPreview = useMemo(() => {
    const list = [t.rooms.entrance, t.rooms.living, t.rooms.kitchen, t.rooms.corridor];
    for (let i = 1; i <= values.bedrooms; i++) list.push(`${t.rooms.bedroom} ${i}`);
    for (let i = 1; i <= values.bathrooms; i++) list.push(`${t.rooms.bathroom} ${i}`);
    for (let i = 1; i <= values.balconies; i++) list.push(`${t.rooms.balcony} ${i}`);
    if (values.hasRoof) list.push(t.rooms.roof);
    return list;
  }, [values.bedrooms, values.bathrooms, values.balconies, values.hasRoof, t]);

  function submit() {
    const firstBad = [0, 1, 2].find((i) => Object.keys(stepErrors(i)).length > 0);
    if (firstBad !== undefined) {
      setErrors(stepErrors(firstBad));
      setStep(firstBad);
      return;
    }
    setFormError(null);
    start(async () => {
      const propertyId = crypto.randomUUID();
      let floorPlan: FloorPlanUpload | null = null;
      if (file) {
        setPhase("uploading");
        try {
          floorPlan = await uploadFloorPlan(file, userId, propertyId);
        } catch (e) {
          setPhase("idle");
          setFormError(e instanceof Error ? e.message : "uploadFailed");
          return;
        }
      }
      setPhase("saving");
      const res = await createPropertyAction({ ...values, propertyId, floorPlan });
      if (!res.ok) {
        if (floorPlan) await discardFloorPlan(floorPlan);
        setPhase("idle");
        setFormError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          const firstBad = STEP_FIELDS.findIndex((fs) => fs.some((f) => res.fieldErrors?.[f]));
          if (firstBad >= 0) setStep(firstBad);
        }
        return;
      }
      router.push(`/inspections/${res.data.inspectionId}`);
    });
  }

  const busy = phase !== "idle";
  const err = (k: string) => (errors[k] ? errorText(errors[k]) : undefined);
  const input = (k: keyof Values, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={k}
      className="field-input"
      value={values[k] as string}
      onChange={(e) => set(k, e.target.value as never)}
      aria-invalid={Boolean(errors[k])}
      {...props}
    />
  );

  return (
    <div className="card overflow-hidden">
      {/* Stepper */}
      <ol className="flex border-b border-navy-100 bg-navy-50/50">
        {steps.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              disabled={busy || i > step}
              onClick={() => setStep(i)}
              className={`flex w-full flex-col items-center gap-1 px-2 py-3 text-xs font-semibold sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${
                i === step ? "text-navy-950" : i < step ? "text-navy-600" : "text-navy-300"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className={`grid size-7 place-items-center rounded-full text-xs ${
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-accent-500 text-white" : "bg-navy-100 text-navy-400"
                }`}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <form
        className="space-y-5 p-5 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) {
            if (validateStep(step)) setStep(step + 1);
          } else submit();
        }}
        noValidate
      >
        {formError && <Alert>{errorText(formError)}</Alert>}

        {step === 0 && (
          <>
            <Field label={t.property.projectName} htmlFor="projectName" error={err("projectName")}>
              {input("projectName", { autoFocus: true, maxLength: 150, required: true })}
            </Field>
            <Field label={t.property.developerName} htmlFor="developerName" optional={t.app.optional} error={err("developerName")}>
              {input("developerName", { maxLength: 150 })}
            </Field>
            <Field label={t.property.address} htmlFor="address" optional={t.app.optional} error={err("address")}>
              {input("address", { maxLength: 300, autoComplete: "street-address" })}
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t.property.propertyType} htmlFor="propertyType">
              <select
                id="propertyType"
                className="field-input"
                value={values.propertyType}
                onChange={(e) => set("propertyType", e.target.value as PropertyType)}
              >
                {PROPERTY_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {t.propertyTypes[p]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t.property.buildingNumber} htmlFor="buildingNumber" error={err("buildingNumber")}>
                {input("buildingNumber", { maxLength: 30, inputMode: "text" })}
              </Field>
              <Field label={t.property.apartmentNumber} htmlFor="apartmentNumber" error={err("apartmentNumber")}>
                {input("apartmentNumber", { maxLength: 30 })}
              </Field>
              <Field label={t.property.floorNumber} htmlFor="floorNumber" error={err("floorNumber")}>
                {input("floorNumber", { maxLength: 30 })}
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Counter label={t.property.bedrooms} value={values.bedrooms} max={20} onChange={(n) => set("bedrooms", n)} />
              <Counter label={t.property.bathrooms} value={values.bathrooms} max={20} onChange={(n) => set("bathrooms", n)} />
              <Counter label={t.property.balconies} value={values.balconies} max={10} onChange={(n) => set("balconies", n)} />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-200 p-3.5 text-[15px] has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50">
              <input type="checkbox" checked={values.hasRoof} onChange={(e) => set("hasRoof", e.target.checked)} className="size-4 accent-navy-800" />
              {t.property.hasRoof}
            </label>
            <div>
              <p className="field-label">{t.property.roomsPreview}</p>
              <div className="flex flex-wrap gap-1.5">
                {roomsPreview.map((r) => (
                  <span key={r} className="rounded-full bg-navy-50 px-2.5 py-1 text-sm text-navy-700 ring-1 ring-navy-100">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label={t.property.inspectionDate} htmlFor="inspectionDate" error={err("inspectionDate")}>
              {input("inspectionDate", { type: "date", required: true })}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.property.ownerName} htmlFor="ownerName" optional={t.app.optional} error={err("ownerName")}>
                {input("ownerName", { maxLength: 150, autoComplete: "name" })}
              </Field>
              <Field label={t.property.inspectorName} htmlFor="inspectorName" optional={t.app.optional} error={err("inspectorName")}>
                {input("inspectorName", { maxLength: 150 })}
              </Field>
            </div>
            <Field label={t.property.notes} htmlFor="notes" optional={t.app.optional} error={err("notes")}>
              <textarea
                id="notes"
                rows={4}
                maxLength={4000}
                className="field-input"
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <Field label={t.property.floorPlan} htmlFor="floorPlan" optional={t.app.optional} error={err("floorPlan")} hint={t.property.floorPlanHint}>
            <input
              ref={fileInput}
              id="floorPlan"
              type="file"
              accept={FLOOR_PLAN_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-navy-200 bg-navy-50/50 p-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-navy-600 ring-1 ring-navy-100">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-900" dir="ltr">
                    {file.name}
                  </p>
                  <p className="text-sm text-navy-400" dir="ltr">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X className="size-4" />
                  {t.property.removeFile}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-navy-200 px-4 py-10 text-navy-500 transition hover:border-navy-400 hover:bg-navy-50/50"
              >
                <Upload className="size-7 text-navy-400" />
                <span className="font-semibold text-navy-800">{t.property.chooseFile}</span>
                <span className="text-sm" dir="ltr">PDF · PNG · JPG</span>
              </button>
            )}
          </Field>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-navy-100 pt-5">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
              <ArrowLeft className="flip-rtl size-4" />
              {t.app.previous}
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button type="submit" variant="primary">
              {t.app.next}
              <ArrowRight className="flip-rtl size-4" />
            </Button>
          ) : (
            <Button type="submit" variant="accent" loading={busy}>
              {phase === "uploading" ? t.property.uploading : phase === "saving" ? t.property.creating : t.property.create}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Counter({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex h-11 items-center justify-between rounded-xl border border-navy-200 px-1">
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg text-navy-600 hover:bg-navy-50 disabled:opacity-40"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={`${label} −`}
        >
          <Minus className="size-4" />
        </button>
        <span className="text-lg font-semibold tabular-nums text-navy-950" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg text-navy-600 hover:bg-navy-50 disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${label} +`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
