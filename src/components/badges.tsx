import type { Dictionary } from "@/lib/i18n";
import type { DefectStatus, InspectionStatus, Severity } from "@/lib/types";

export const SEVERITY_STYLES: Record<Severity, { dot: string; badge: string }> = {
  critical: { dot: "bg-sev-critical", badge: "bg-red-50 text-red-700 ring-red-200" },
  high: { dot: "bg-sev-high", badge: "bg-orange-50 text-orange-700 ring-orange-200" },
  medium: { dot: "bg-sev-medium", badge: "bg-yellow-50 text-yellow-800 ring-yellow-200" },
  low: { dot: "bg-sev-low", badge: "bg-blue-50 text-blue-700 ring-blue-200" },
};

const DEFECT_STATUS_STYLES: Record<DefectStatus, string> = {
  open: "bg-red-50 text-red-700 ring-red-200",
  under_correction: "bg-amber-50 text-amber-800 ring-amber-200",
  pending_reinspection: "bg-violet-50 text-violet-700 ring-violet-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-slate-100 text-slate-600 ring-slate-200",
};

const INSPECTION_STATUS_STYLES: Record<InspectionStatus, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  in_progress: "bg-accent-50 text-accent-700 ring-accent-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap";

export function SeverityBadge({ severity, t }: { severity: Severity; t: Dictionary }) {
  return (
    <span className={`${base} ${SEVERITY_STYLES[severity].badge}`}>
      <span className={`size-1.5 rounded-full ${SEVERITY_STYLES[severity].dot}`} aria-hidden />
      {t.severity[severity]}
    </span>
  );
}

export function DefectStatusBadge({ status, t }: { status: DefectStatus; t: Dictionary }) {
  return <span className={`${base} ${DEFECT_STATUS_STYLES[status]}`}>{t.defectStatus[status]}</span>;
}

export function InspectionStatusBadge({ status, t }: { status: InspectionStatus; t: Dictionary }) {
  return <span className={`${base} ${INSPECTION_STATUS_STYLES[status]}`}>{t.status[status]}</span>;
}
