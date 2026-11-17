"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { DEFECT_STATUSES, SEVERITIES } from "@/lib/types";

export function DefectFilters({ rooms }: { rooms: { id: string; label: string }[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("upload");
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  const select = "field-input h-10 py-0 text-sm sm:w-auto";
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <select aria-label={t.defect.filterSeverity} className={select} value={params.get("severity") ?? ""} onChange={(e) => update("severity", e.target.value)}>
        <option value="">
          {t.defect.filterSeverity}: {t.app.all}
        </option>
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {t.severity[s]}
          </option>
        ))}
      </select>
      <select aria-label={t.defect.filterStatus} className={select} value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
        <option value="">
          {t.defect.filterStatus}: {t.app.all}
        </option>
        {DEFECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t.defectStatus[s]}
          </option>
        ))}
      </select>
      <select aria-label={t.defect.filterRoom} className={select} value={params.get("room") ?? ""} onChange={(e) => update("room", e.target.value)}>
        <option value="">
          {t.defect.filterRoom}: {t.app.all}
        </option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <select aria-label="Sort" className={select} value={params.get("sort") ?? ""} onChange={(e) => update("sort", e.target.value)}>
        <option value="">{lang === "ar" ? "ترتيب: الرقم" : "Sort: number"}</option>
        <option value="severity">{lang === "ar" ? "ترتيب: الخطورة" : "Sort: severity"}</option>
      </select>
    </div>
  );
}
