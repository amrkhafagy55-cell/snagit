"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { validatePhoto } from "@/lib/photos";

/** Lets the user pick/take several photos and previews them before upload. */
export function PhotoPicker({
  files,
  onChange,
  disabled,
  label,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function add(list: FileList | null) {
    if (!list) return;
    setError(null);
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      const problem = validatePhoto(f);
      if (problem) setError(problem);
      else accepted.push(f);
    }
    onChange([...files, ...accepted].slice(0, 20));
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="sr-only"
        onChange={(e) => add(e.target.files)}
        disabled={disabled}
        aria-label={label ?? t.defect.takePhoto}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
            <img src={src} alt="" className="size-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-navy-950/70 text-white hover:bg-navy-950"
                aria-label={t.property.removeFile}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-center text-xs font-semibold text-navy-500 transition hover:border-navy-400 hover:text-navy-800 disabled:opacity-50"
        >
          <Camera className="size-6" aria-hidden />
          {label ?? t.defect.takePhoto}
        </button>
      </div>
      {error ? <p className="field-error">{errorText(error)}</p> : <p className="mt-1.5 text-sm text-navy-400">{t.defect.photoHint}</p>}
    </div>
  );
}
