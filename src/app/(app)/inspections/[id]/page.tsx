import Link from "next/link";
import {
  Bath, BedDouble, ChevronRight, CookingPot, DoorOpen, Fence, LayoutGrid, Map as MapIcon, Plus, Sofa,
  Sun, Footprints,
} from "lucide-react";
import { LinkButton, ProgressBar } from "@/components/ui";
import { SEVERITY_STYLES } from "@/components/badges";
import { ActionButton } from "@/components/action-buttons";
import { completion, getInspection, getPlanImageUrl, getRoomProgress } from "@/lib/data";
import { formatDate, formatNumber, roomLabel } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { SEVERITIES, type RoomType } from "@/lib/types";
import { deleteInspectionAction, setInspectionStatusAction } from "../../_actions/inspections";
import { AddRoomForm } from "./_components/add-room";
import { RemarksEditor } from "./_components/remarks";

const ROOM_ICONS: Record<RoomType, typeof Sofa> = {
  entrance: DoorOpen,
  living: Sofa,
  bedroom: BedDouble,
  kitchen: CookingPot,
  bathroom: Bath,
  balcony: Fence,
  corridor: Footprints,
  roof: Sun,
  other: LayoutGrid,
};

export default async function InspectionOverviewPage({ params }: PageProps<"/inspections/[id]">) {
  const { id } = await params;
  const [{ inspection, property, summary, rooms }, roomProgress, { t, lang }] = await Promise.all([
    getInspection(id),
    getRoomProgress(id),
    getI18n(),
  ]);
  const pct = completion(summary);
  const notInspected = summary.items_total - summary.items_passed - summary.items_failed;
  const planUrl = await getPlanImageUrl(property);
  const n = (v: number) => formatNumber(v, lang);
  const sevCounts = {
    critical: summary.defects_critical,
    high: summary.defects_high,
    medium: summary.defects_medium,
    low: summary.defects_low,
  };

  const details: [string, string][] = [
    [t.property.propertyType, t.propertyTypes[property.property_type]],
    [t.property.developerName, property.developer_name],
    [t.property.buildingNumber, property.building_number],
    [t.property.apartmentNumber, property.apartment_number],
    [t.property.floorNumber, property.floor_number],
    [t.property.bedrooms, String(property.bedrooms)],
    [t.property.bathrooms, String(property.bathrooms)],
    [t.property.ownerName, property.owner_name],
    [t.property.inspectorName, inspection.inspector_name],
    [t.property.inspectionDate, formatDate(inspection.inspection_date, lang)],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Progress */}
        <section className="card p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-navy-500">{t.workspace.progress}</h2>
              <p className="mt-1 text-4xl font-bold tracking-tight text-navy-950">{n(pct)}%</p>
            </div>
            <p className="text-sm text-navy-500">
              {n(summary.items_passed + summary.items_failed)} / {n(summary.items_total)} {t.workspace.items}
            </p>
          </div>
          <ProgressBar value={pct} className="mt-4 h-2.5" />
          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3">
              <dt className="text-xs font-semibold text-emerald-700">{t.workspace.passed}</dt>
              <dd className="text-xl font-bold text-emerald-800">{n(summary.items_passed)}</dd>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <dt className="text-xs font-semibold text-red-700">{t.workspace.failed}</dt>
              <dd className="text-xl font-bold text-red-800">{n(summary.items_failed)}</dd>
            </div>
            <div className="rounded-xl bg-navy-50 p-3">
              <dt className="text-xs font-semibold text-navy-600">{t.workspace.notInspected}</dt>
              <dd className="text-xl font-bold text-navy-800">{n(notInspected)}</dd>
            </div>
          </dl>
        </section>

        {/* Rooms */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-900">{t.workspace.rooms}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((room) => {
              const p = roomProgress.get(room.id) ?? { total: 0, done: 0, failed: 0, defects: 0 };
              const rp = p.total ? Math.round((p.done / p.total) * 100) : 0;
              const Icon = ROOM_ICONS[room.room_type];
              return (
                <Link
                  key={room.id}
                  href={`/inspections/${id}/rooms/${room.id}`}
                  className="card group flex items-center gap-4 p-4 transition hover:border-navy-200 hover:shadow-md hover:shadow-navy-900/5"
                >
                  <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${rp === 100 ? "bg-emerald-50 text-emerald-600" : "bg-navy-50 text-navy-600"}`}>
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-navy-900">{roomLabel(room, t)}</p>
                      {p.defects > 0 && (
                        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          {n(p.defects)} {t.dashboard.openDefects}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={rp} className="h-1.5" />
                      <span className="w-16 shrink-0 text-end text-xs tabular-nums text-navy-500">
                        {n(p.done)}/{n(p.total)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="flip-rtl size-4 shrink-0 text-navy-300 group-hover:text-navy-600" aria-hidden />
                </Link>
              );
            })}
          </div>
          <div className="mt-3">
            <AddRoomForm inspectionId={id} />
          </div>
        </section>

        <RemarksEditor inspectionId={id} initial={inspection.general_remarks} />
      </div>

      <aside className="space-y-6">
        {/* Defects by severity */}
        <section className="card p-5">
          <h2 className="font-semibold text-navy-900">{t.workspace.defectSummary}</h2>
          <ul className="mt-4 space-y-2.5">
            {SEVERITIES.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-navy-700">
                  <span className={`size-2.5 rounded-full ${SEVERITY_STYLES[s].dot}`} aria-hidden />
                  {t.severity[s]}
                </span>
                <span className="font-semibold tabular-nums text-navy-950">{n(sevCounts[s])}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-2">
            <LinkButton href={`/inspections/${id}/defects/new`} variant="accent" size="md">
              <Plus className="size-4" aria-hidden />
              {t.workspace.addDefect}
            </LinkButton>
            <LinkButton href={`/inspections/${id}/defects`} variant="secondary" size="md">
              {t.workspace.viewDefects}
            </LinkButton>
          </div>
        </section>

        {/* Floor plan */}
        <section className="card p-5">
          <h2 className="font-semibold text-navy-900">{t.workspace.floorPlan}</h2>
          {planUrl ? (
            <Link href={`/inspections/${id}/plan`} className="group mt-3 block">
              <img src={planUrl} alt={t.workspace.floorPlan} className="max-h-64 w-full rounded-xl border border-navy-100 bg-white object-contain" />
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 group-hover:text-accent-600">
                <MapIcon className="size-3.5" aria-hidden />
                {t.workspace.openFloorPlan}
              </span>
            </Link>
          ) : (
            <Link href={`/inspections/${id}/plan`} className="mt-2 block text-sm text-navy-400 hover:text-accent-600">
              {t.workspace.noFloorPlan} <span className="font-semibold text-navy-600">{t.plan.layoutTitle} →</span>
            </Link>
          )}
        </section>

        {/* Property details */}
        <section className="card p-5">
          <h2 className="font-semibold text-navy-900">{t.workspace.details}</h2>
          <dl className="mt-3 divide-y divide-navy-50 text-sm">
            {details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-navy-500">{k}</dt>
                  <dd className="text-end font-medium text-navy-900">{v}</dd>
                </div>
              ))}
          </dl>
          {property.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-navy-50/60 p-3 text-sm text-navy-700">{property.notes}</p>}
        </section>

        {/* Status actions */}
        <section className="flex flex-col gap-2">
          {inspection.status === "completed" ? (
            <ActionButton action={setInspectionStatusAction.bind(null, id, "in_progress")} variant="secondary" className="w-full">
              {t.workspace.reopen}
            </ActionButton>
          ) : (
            <ActionButton action={setInspectionStatusAction.bind(null, id, "completed")} variant="primary" className="w-full">
              {t.workspace.markCompleted}
            </ActionButton>
          )}
          <ActionButton
            action={deleteInspectionAction.bind(null, id)}
            variant="danger"
            className="w-full"
            confirmText={t.workspace.deleteInspectionConfirm}
            pendingLabel={t.app.deleting}
          >
            {t.workspace.deleteInspection}
          </ActionButton>
        </section>
      </aside>
    </div>
  );
}
