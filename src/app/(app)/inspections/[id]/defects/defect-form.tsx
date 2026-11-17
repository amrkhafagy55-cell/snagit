"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, MapPin } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { PhotoPicker } from "@/components/photo-picker";
import { SEVERITY_STYLES } from "@/components/badges";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { categoryLabel } from "@/lib/i18n";
import { uploadDefectPhotos } from "@/lib/photos";
import { DEFECT_STATUSES, SEVERITIES, type DefectStatus, type Severity } from "@/lib/types";
import type { DefectInput } from "@/lib/validation";
import { createDefectAction, registerPhotosAction, updateDefectAction } from "../../../_actions/defects";

type Values = Omit<DefectInput, "inspectionId">;

export function DefectForm({
  mode,
  inspectionId,
  userId,
  defectId,
  rooms,
  categories,
  initial,
  linkedItemTitle,
  returnToPlan = false,
}: {
  mode: "create" | "edit";
  inspectionId: string;
  userId: string;
  defectId?: string;
  rooms: { id: string; label: string }[];
  categories: string[];
  initial: Values;
  linkedItemTitle?: string;
  returnToPlan?: boolean;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading">("idle");
  const [progress, setProgress] = useState("");
  const [, start] = useTransition();
  const NEW = "__new__";
  const [categoryChoice, setCategoryChoice] = useState(categories.includes(initial.category) ? initial.category : NEW);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!values.title.trim()) local.title = "required";
    if (!values.category.trim()) local.category = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    setFormError(null);

    start(async () => {
      setPhase("saving");
      const payload = { ...values, inspectionId };
      if (mode === "edit" && defectId) {
        const res = await updateDefectAction(defectId, payload);
        if (!res.ok) {
          setPhase("idle");
          setFormError(res.error);
          if (res.fieldErrors) setErrors(res.fieldErrors);
          return;
        }
        router.push(`/inspections/${inspectionId}/defects/${defectId}`);
        return;
      }

      const res = await createDefectAction(payload);
      if (!res.ok) {
        setPhase("idle");
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        return;
      }
      const newId = res.data.defectId;
      let uploadFailed = false;
      if (photos.length) {
        setPhase("uploading");
        try {
          const uploaded = await uploadDefectPhotos({
            files: photos,
            userId,
            inspectionId,
            defectId: newId,
            kind: "before",
            onProgress: (d, total) => setProgress(`${d}/${total}`),
          });
          const reg = await registerPhotosAction(newId, uploaded);
          uploadFailed = !reg.ok;
        } catch {
          uploadFailed = true;
        }
      }
      router.push(
        returnToPlan && !uploadFailed
          ? `/inspections/${inspectionId}/plan?focus=${newId}`
          : `/inspections/${inspectionId}/defects/${newId}${uploadFailed ? "?upload=failed" : ""}`,
      );
    });
  }

  const busy = phase !== "idle";
  const err = (k: string) => (errors[k] ? errorText(errors[k]) : undefined);

  return (
    <form onSubmit={submit} className="space-y-6 pb-4" noValidate>
      {formError && <Alert>{errorText(formError)}</Alert>}

      {values.planX != null && values.planY != null && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-sm text-accent-700">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {t.plan.locationSet}
        </div>
      )}

      {linkedItemTitle && (
        <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2 text-sm text-navy-700">
          <Link2 className="size-4 shrink-0" aria-hidden />
          <span>
            {t.defect.linkedItem}: <strong>{linkedItemTitle}</strong>
          </span>
        </div>
      )}

      <section className="card space-y-4 p-5 sm:p-6">
        <Field label={t.defect.title} htmlFor="title" error={err("title")}>
          <input
            id="title"
            className="field-input"
            value={values.title}
            maxLength={200}
            placeholder={t.defect.titlePlaceholder}
            onChange={(e) => set("title", e.target.value)}
            aria-invalid={Boolean(errors.title)}
            autoFocus={!values.title}
          />
        </Field>

        <fieldset>
          <legend className="field-label">{t.defect.severity}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEVERITIES.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-200 px-3 py-2.5 text-sm font-semibold text-navy-700 has-[:checked]:border-navy-800 has-[:checked]:bg-navy-50 has-[:checked]:text-navy-950"
              >
                <input
                  type="radio"
                  name="severity"
                  value={s}
                  checked={values.severity === s}
                  onChange={() => set("severity", s as Severity)}
                  className="sr-only"
                />
                <span className={`size-3 rounded-full ${SEVERITY_STYLES[s].dot}`} aria-hidden />
                {t.severity[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.defect.room} htmlFor="room">
            <select
              id="room"
              className="field-input"
              value={values.roomId ?? ""}
              onChange={(e) => set("roomId", e.target.value || null)}
            >
              <option value="">{t.defect.noRoom}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.defect.category} htmlFor="category" error={err("category")}>
            <select
              id="category"
              className="field-input"
              value={categoryChoice}
              onChange={(e) => {
                setCategoryChoice(e.target.value);
                set("category", e.target.value === NEW ? "" : e.target.value);
              }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, t)}
                </option>
              ))}
              <option value={NEW}>{t.checklist.customCategory}</option>
            </select>
            {categoryChoice === NEW && (
              <input
                className="field-input mt-2"
                placeholder={t.checklist.customCategoryName}
                aria-label={t.checklist.customCategoryName}
                value={values.category}
                maxLength={60}
                onChange={(e) => set("category", e.target.value)}
                aria-invalid={Boolean(errors.category)}
              />
            )}
          </Field>
        </div>

        <Field label={t.defect.locationNote} htmlFor="locationNote" optional={t.app.optional} error={err("locationNote")}>
          <input
            id="locationNote"
            className="field-input"
            value={values.locationNote}
            maxLength={200}
            placeholder={t.defect.locationNotePlaceholder}
            onChange={(e) => set("locationNote", e.target.value)}
          />
        </Field>

        <Field label={t.defect.description} htmlFor="description" optional={t.app.optional} error={err("description")}>
          <textarea
            id="description"
            rows={3}
            maxLength={4000}
            className="field-input"
            value={values.description}
            placeholder={t.defect.descriptionPlaceholder}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
      </section>

      {mode === "create" && (
        <section className="card p-5 sm:p-6">
          <h2 className="field-label">{t.defect.beforePhotos}</h2>
          <PhotoPicker files={photos} onChange={setPhotos} disabled={busy} />
        </section>
      )}

      <section className="card space-y-4 p-5 sm:p-6">
        <Field label={t.defect.action} htmlFor="action" optional={t.app.optional} error={err("recommendedAction")}>
          <textarea
            id="action"
            rows={3}
            maxLength={4000}
            className="field-input"
            value={values.recommendedAction}
            placeholder={t.defect.actionPlaceholder}
            onChange={(e) => set("recommendedAction", e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.defect.status} htmlFor="status">
            <select id="status" className="field-input" value={values.status} onChange={(e) => set("status", e.target.value as DefectStatus)}>
              {DEFECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.defectStatus[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.defect.identifiedOn} htmlFor="identifiedOn" error={err("identifiedOn")}>
            <input
              id="identifiedOn"
              type="date"
              className="field-input"
              value={values.identifiedOn}
              onChange={(e) => set("identifiedOn", e.target.value)}
            />
          </Field>
          <Field label={t.defect.responsible} htmlFor="responsible" optional={t.app.optional} error={err("responsibleParty")}>
            <input
              id="responsible"
              className="field-input"
              value={values.responsibleParty}
              maxLength={150}
              placeholder={t.defect.responsiblePlaceholder}
              onChange={(e) => set("responsibleParty", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-[4.75rem] z-10 flex items-center justify-end gap-2 rounded-2xl border border-navy-100 bg-white p-3 shadow-lg shadow-navy-900/10 md:bottom-4">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          {t.app.cancel}
        </Button>
        <Button type="submit" variant="accent" size="lg" loading={busy}>
          {phase === "uploading" ? `${t.defect.uploadingPhotos} ${progress}` : phase === "saving" ? t.defect.creating : t.defect.create}
        </Button>
      </div>
    </form>
  );
}
