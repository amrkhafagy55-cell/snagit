"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { PhotoPicker } from "@/components/photo-picker";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n";
import { uploadDefectPhotos } from "@/lib/photos";
import { DEFECT_STATUSES, type DefectPhoto, type DefectStatus, type PhotoKind } from "@/lib/types";
import { deletePhotoAction, registerPhotosAction, updateReinspectionAction } from "../../../../_actions/defects";

export function PhotoGallery({ photos, emptyText }: { photos: DefectPhoto[]; emptyText: string }) {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!photos.length) return <p className="text-sm text-navy-400">{emptyText}</p>;
  return (
    <>
      {error && <p className="field-error mb-2">{errorText(error)}</p>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p) => (
          <li key={p.id} className="group relative overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
                <img src={p.url} alt={p.caption || t.defect.photos} className="size-full object-cover" loading="lazy" />
              </a>
            ) : (
              <div className="aspect-[4/3]" />
            )}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-navy-500">
              <span>{formatDate(p.taken_at, lang)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(t.app.areYouSure)) return;
                  setBusyId(p.id);
                  start(async () => {
                    const res = await deletePhotoAction(p.id);
                    setBusyId(null);
                    if (!res.ok) setError(res.error);
                    else router.refresh();
                  });
                }}
                className="grid size-7 place-items-center rounded-lg text-navy-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={t.defect.deletePhoto}
                title={t.defect.deletePhoto}
              >
                <Trash2 className={`size-3.5 ${busyId === p.id ? "animate-pulse" : ""}`} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PhotoUploader({
  userId,
  inspectionId,
  defectId,
  kind,
  label,
}: {
  userId: string;
  inspectionId: string;
  defectId: string;
  kind: PhotoKind;
  label: string;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 border-t border-navy-50 pt-4">
      <PhotoPicker files={files} onChange={setFiles} disabled={pending} label={label} />
      {error && <p className="field-error">{errorText(error)}</p>}
      {files.length > 0 && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  const uploaded = await uploadDefectPhotos({
                    files,
                    userId,
                    inspectionId,
                    defectId,
                    kind,
                    onProgress: (d, total) => setProgress(`${d}/${total}`),
                  });
                  const res = await registerPhotosAction(defectId, uploaded);
                  if (!res.ok) throw new Error(res.error);
                  setFiles([]);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "uploadFailed");
                } finally {
                  setProgress("");
                }
              })
            }
          >
            <Upload className="size-4" aria-hidden />
            {pending ? `${t.defect.uploadingPhotos} ${progress}` : t.defect.addPhotos}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReinspectionForm({
  defectId,
  initial,
}: {
  defectId: string;
  initial: { status: DefectStatus; reinspectionNotes: string; correctedOn: string | null };
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          const res = await updateReinspectionAction({ defectId, ...values, correctedOn: values.correctedOn || null });
          if (!res.ok) setMessage({ tone: "error", text: errorText(res.error) });
          else {
            setMessage({ tone: "success", text: t.app.saved });
            router.refresh();
          }
        });
      }}
    >
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.defect.status} htmlFor="r-status">
          <select
            id="r-status"
            className="field-input"
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as DefectStatus }))}
          >
            {DEFECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.defectStatus[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.defect.correctedOn} htmlFor="r-date" optional={t.app.optional}>
          <input
            id="r-date"
            type="date"
            className="field-input"
            value={values.correctedOn ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, correctedOn: e.target.value || null }))}
          />
        </Field>
      </div>
      <Field label={t.defect.reinspectionNotes} htmlFor="r-notes" optional={t.app.optional}>
        <textarea
          id="r-notes"
          rows={3}
          maxLength={4000}
          className="field-input"
          value={values.reinspectionNotes}
          onChange={(e) => setValues((v) => ({ ...v, reinspectionNotes: e.target.value }))}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          {t.defect.updateStatus}
        </Button>
      </div>
    </form>
  );
}
