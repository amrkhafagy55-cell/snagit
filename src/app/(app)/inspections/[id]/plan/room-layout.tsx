import Link from "next/link";
import { Plus } from "lucide-react";
import { MARKER_COLORS } from "@/components/plan/marker-colors";
import type { Dictionary } from "@/lib/i18n";
import type { RoomType, Severity } from "@/lib/types";

export type LayoutRoom = {
  id: string;
  label: string;
  type: RoomType;
  openBySeverity: Record<Severity, number>;
};

// Rough footprint per room type so the grid reads like an apartment, not a list.
const SPAN: Record<RoomType, string> = {
  living: "col-span-2 row-span-2",
  bedroom: "col-span-2 sm:col-span-1 sm:row-span-2",
  kitchen: "col-span-1 row-span-2",
  bathroom: "col-span-1",
  entrance: "col-span-1",
  corridor: "col-span-2 sm:col-span-1",
  balcony: "col-span-2",
  roof: "col-span-2 row-span-2",
  other: "col-span-1",
};

const RANK: Severity[] = ["critical", "high", "medium", "low"];
const BORDER: Record<Severity, string> = {
  critical: "border-sev-critical",
  high: "border-sev-high",
  medium: "border-sev-medium",
  low: "border-sev-low",
};

/** Visual apartment layout used when no floor plan is uploaded. */
export function RoomLayout({ inspectionId, rooms, t }: { inspectionId: string; rooms: LayoutRoom[]; t: Dictionary }) {
  return (
    <div className="grid auto-rows-[5.5rem] grid-flow-dense grid-cols-2 gap-2 rounded-2xl border-4 border-navy-900 bg-navy-900 p-2 sm:grid-cols-4">
      {rooms.map((room) => {
        const worst = RANK.find((s) => room.openBySeverity[s] > 0);
        const total = RANK.reduce((n, s) => n + room.openBySeverity[s], 0);
        return (
          <div
            key={room.id}
            className={`relative flex flex-col justify-between rounded-lg border-2 bg-white p-2.5 ${SPAN[room.type]} ${worst ? BORDER[worst] : "border-transparent"}`}
          >
            <Link href={`/inspections/${inspectionId}/rooms/${room.id}`} className="absolute inset-0 rounded-lg hover:bg-navy-50/60" aria-label={`${room.label} · ${t.plan.checklist}`} />
            <p className="relative pointer-events-none text-sm font-semibold leading-tight text-navy-900">{room.label}</p>
            <div className="relative flex items-end justify-between gap-1">
              <div className="pointer-events-none flex flex-wrap gap-1">
                {RANK.filter((s) => room.openBySeverity[s] > 0).map((s) => (
                  <span key={s} className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${MARKER_COLORS[s]}`} title={t.severity[s]}>
                    {room.openBySeverity[s]}
                  </span>
                ))}
                {total === 0 && <span className="text-[11px] text-navy-300">—</span>}
              </div>
              <Link
                href={`/inspections/${inspectionId}/defects/new?room=${room.id}`}
                className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-accent-500 text-white shadow-sm hover:bg-accent-600"
                title={t.plan.addDefect}
                aria-label={`${t.plan.addDefect} · ${room.label}`}
              >
                <Plus className="size-4" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
