"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, MapPin, Move, Plus, Trash2, X } from "lucide-react";
import { Alert, Button, LinkButton } from "@/components/ui";
import { DefectStatusBadge, SeverityBadge } from "@/components/badges";
import { PlanViewer, type PlanMarker } from "@/components/plan/plan-viewer";
import { MARKER_COLORS } from "@/components/plan/marker-colors";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { SEVERITIES, type DefectStatus, type Severity } from "@/lib/types";
import { setDefectPinAction } from "../../../_actions/plan";

export type PlanDefect = {
  id: string;
  number: number;
  title: string;
  severity: Severity;
  status: DefectStatus;
  roomLabel: string | null;
  x: number | null;
  y: number | null;
};

const CLOSED: DefectStatus[] = ["resolved", "rejected"];

export function PlanWorkspace({
  inspectionId,
  plan,
  initialDefects,
  initialPinId,
  initialFocusId,
}: {
  inspectionId: string;
  plan: { url: string; width: number; height: number };
  initialDefects: PlanDefect[];
  initialPinId?: string;
  initialFocusId?: string;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [defects, setDefects] = useState(initialDefects);
  const [placingId, setPlacingId] = useState<string | null>(
    initialPinId && initialDefects.some((d) => d.id === initialPinId) ? initialPinId : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialFocusId ?? null);
  const [tapAt, setTapAt] = useState<{ x: number; y: number } | null>(null);
  const [hideResolved, setHideResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(defects.map((d) => [d.id, d])), [defects]);
  const pinned = defects.filter((d) => d.x !== null && d.y !== null);
  const unpinned = defects.filter((d) => d.x === null || d.y === null);
  const visible = pinned.filter((d) => !(hideResolved && CLOSED.includes(d.status)));
  const markers: PlanMarker[] = visible.map((d) => ({ id: d.id, number: d.number, severity: d.severity, status: d.status, x: d.x!, y: d.y! }));
  const dimmed = useMemo(() => new Set(defects.filter((d) => CLOSED.includes(d.status)).map((d) => d.id)), [defects]);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const placing = placingId ? byId.get(placingId) : undefined;

  const initialFocus = useMemo(() => {
    const d = initialDefects.find((x) => x.id === initialFocusId && x.x !== null);
    return d ? { x: d.x!, y: d.y!, key: d.id } : null;
  }, [initialDefects, initialFocusId]);

  function savePin(id: string, x: number | null, y: number | null) {
    const before = byId.get(id);
    setDefects((list) => list.map((d) => (d.id === id ? { ...d, x, y } : d)));
    setError(null);
    start(async () => {
      const res = await setDefectPinAction(id, x, y);
      if (!res.ok) {
        setError(res.error);
        if (before) setDefects((list) => list.map((d) => (d.id === id ? before : d)));
      } else router.refresh();
    });
  }

  function onTapPlan(x: number, y: number) {
    if (placingId) {
      savePin(placingId, x, y);
      setSelectedId(placingId);
      setPlacingId(null);
      return;
    }
    setSelectedId(null);
    setTapAt({ x, y });
  }

  const coord = (n: number) => n.toFixed(5);
  // Open cards away from the point they describe so they never hide it (physical sides: the plan is LTR).
  const cardPos = (pt: { x: number; y: number }) =>
    `${pt.y > 0.55 ? "top-2" : "bottom-2"} ${pt.x < 0.5 ? "sm:right-2" : "sm:left-2"}`;

  return (
    <div className="space-y-4">
      {error && <Alert>{errorText(error)}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-navy-600">
          {SEVERITIES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`size-3 rounded-full ${MARKER_COLORS[s].split(" ")[0]}`} aria-hidden />
              {t.severity[s]}
            </span>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy-700">
          <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} className="size-4 accent-navy-800" />
          {t.plan.hideResolved}
        </label>
      </div>

      <div className="card overflow-hidden">
        <PlanViewer
          imageUrl={plan.url}
          width={plan.width}
          height={plan.height}
          markers={markers}
          selectedId={selectedId}
          dimmedIds={dimmed}
          ghost={tapAt}
          focus={initialFocus}
          crosshair={Boolean(placingId)}
          onTapPlan={onTapPlan}
          onTapMarker={(id) => {
            setTapAt(null);
            setPlacingId(null);
            setSelectedId(id === selectedId ? null : id);
          }}
          labels={{ zoomIn: t.plan.zoomIn, zoomOut: t.plan.zoomOut, fit: t.plan.fit, plan: t.plan.title }}
          className="h-[62vh] min-h-[340px]"
        >
          {/* Placing banner */}
          {placing && (
            <div className="absolute inset-x-2 top-2 z-30 flex items-center gap-3 rounded-xl bg-navy-950 px-3 py-2.5 text-sm text-white shadow-lg sm:inset-x-auto sm:start-2 sm:max-w-md">
              <MapPin className="size-4 shrink-0 text-accent-400" aria-hidden />
              <span className="min-w-0 flex-1">
                {t.plan.placing}{" "}
                <strong dir="ltr">D-{placing.number}</strong> <span className="text-navy-300">{placing.title}</span>
              </span>
              <button type="button" onClick={() => setPlacingId(null)} className="grid size-7 place-items-center rounded-lg hover:bg-white/10" aria-label={t.app.cancel}>
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Tapped an empty spot */}
          {tapAt && !placing && (
            <div className={`absolute inset-x-2 z-30 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-navy-100 sm:inset-x-auto sm:w-80 ${cardPos(tapAt)}`}>
              <div className="flex items-center justify-between gap-2">
                <LinkButton
                  href={`/inspections/${inspectionId}/defects/new?x=${coord(tapAt.x)}&y=${coord(tapAt.y)}&from=plan`}
                  variant="accent"
                  size="sm"
                  className="flex-1"
                >
                  <Plus className="size-4" aria-hidden />
                  {t.plan.newHere}
                </LinkButton>
                <button type="button" onClick={() => setTapAt(null)} className="grid size-9 place-items-center rounded-lg text-navy-400 hover:bg-navy-50" aria-label={t.app.close}>
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-3 text-xs font-semibold text-navy-500">{t.plan.pinExisting}</p>
              {unpinned.length === 0 ? (
                <p className="mt-1 text-sm text-navy-400">{t.plan.allPinned}</p>
              ) : (
                <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                  {unpinned.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          savePin(d.id, tapAt.x, tapAt.y);
                          setTapAt(null);
                          setSelectedId(d.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-navy-50"
                      >
                        <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] font-bold ${MARKER_COLORS[d.severity]}`}>{d.number}</span>
                        <span className="min-w-0 flex-1 truncate text-navy-800">{d.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Marker card */}
          {selected && selected.x !== null && !placing && !tapAt && (
            <div className={`absolute inset-x-2 z-30 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-navy-100 sm:inset-x-auto sm:w-80 ${cardPos({ x: selected.x, y: selected.y! })}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-navy-900 px-1.5 py-0.5 text-[11px] font-bold text-white" dir="ltr">
                      D-{selected.number}
                    </span>
                    <SeverityBadge severity={selected.severity} t={t} />
                    <DefectStatusBadge status={selected.status} t={t} />
                  </div>
                  <p className="mt-2 font-semibold text-navy-950">{selected.title}</p>
                  {selected.roomLabel && <p className="text-sm text-navy-500">{selected.roomLabel}</p>}
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-navy-400 hover:bg-navy-50" aria-label={t.app.close}>
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <LinkButton href={`/inspections/${inspectionId}/defects/${selected.id}`} variant="primary" size="sm">
                  <ExternalLink className="size-3.5" aria-hidden />
                  {t.plan.open}
                </LinkButton>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPlacingId(selected.id)}>
                  <Move className="size-3.5" aria-hidden />
                  {t.plan.move}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    savePin(selected.id, null, null);
                    setSelectedId(null);
                  }}
                  title={t.plan.removePin}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  <span className="sr-only sm:not-sr-only">{t.plan.removePinShort}</span>
                </Button>
              </div>
            </div>
          )}
        </PlanViewer>
        <p className="border-t border-navy-50 px-4 py-2.5 text-xs text-navy-500">{t.plan.hint}</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy-700">
          {t.plan.unpinned} <span className="text-navy-400">({unpinned.length})</span>
          <span className="ms-3 font-normal text-navy-400">
            · {pinned.length} {t.plan.pinsCount}
          </span>
        </h2>
        {unpinned.length === 0 ? (
          <p className="text-sm text-navy-400">{t.plan.allPinned}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {unpinned.map((d) => (
              <li key={d.id} className={`card flex items-center gap-3 p-3 ${placingId === d.id ? "ring-2 ring-accent-500" : ""}`}>
                <span className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold ${MARKER_COLORS[d.severity]}`}>{d.number}</span>
                <Link href={`/inspections/${inspectionId}/defects/${d.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900 hover:underline">{d.title}</p>
                  {d.roomLabel && <p className="truncate text-xs text-navy-500">{d.roomLabel}</p>}
                </Link>
                <Button
                  type="button"
                  variant={placingId === d.id ? "accent" : "secondary"}
                  size="sm"
                  onClick={() => {
                    setTapAt(null);
                    setSelectedId(null);
                    setPlacingId(placingId === d.id ? null : d.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <MapPin className="size-3.5" aria-hidden />
                  {t.plan.pin}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
