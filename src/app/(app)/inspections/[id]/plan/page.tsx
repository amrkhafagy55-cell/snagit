import type { Metadata } from "next";
import { FileText, Map as MapIcon } from "lucide-react";
import { FloorPlanUploader } from "@/components/plan/floor-plan-uploader";
import { requireUser } from "@/lib/auth";
import { getDefects, getInspection, getPlanImageUrl, signedUrls } from "@/lib/data";
import { roomLabel } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import type { Severity } from "@/lib/types";
import { PlanWorkspace, type PlanDefect } from "./plan-workspace";
import { RoomLayout, type LayoutRoom } from "./room-layout";
import { isInspectionUnlocked } from "@/lib/billing";

export const metadata: Metadata = { title: "Floor plan" };

export default async function PlanPage({ params, searchParams }: PageProps<"/inspections/[id]/plan">) {
  const { id } = await params;
  const sp = await searchParams;
  const [user, { property, rooms }, defects, { t }] = await Promise.all([
    requireUser(),
    getInspection(id),
    getDefects(id),
    getI18n(),
  ]);
  const unlocked = await isInspectionUnlocked(id);

  const hasPlan = Boolean(property.floor_plan_image_path && property.floor_plan_width && property.floor_plan_height);
  const [imageUrl, originalUrl] = await Promise.all([
    hasPlan ? getPlanImageUrl(property) : Promise.resolve(null),
    property.floor_plan_mime === "application/pdf" && property.floor_plan_path
      ? signedUrls("floor-plans", [property.floor_plan_path]).then((m) => m.get(property.floor_plan_path!) ?? null)
      : Promise.resolve(null),
  ]);
  const roomNames = new Map(rooms.map((r) => [r.id, roomLabel(r, t)]));

  const planDefects: PlanDefect[] = defects.map((d) => ({
    id: d.id,
    number: d.number,
    title: d.title,
    severity: d.severity,
    status: d.status,
    roomLabel: d.room_id ? (roomNames.get(d.room_id) ?? null) : null,
    x: d.plan_x,
    y: d.plan_y,
  }));

  const layoutRooms: LayoutRoom[] = rooms.map((r) => {
    const open: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const d of defects) if (d.room_id === r.id && d.status !== "resolved" && d.status !== "rejected") open[d.severity]++;
    return { id: r.id, label: roomLabel(r, t), type: r.room_type, openBySeverity: open };
  });

  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy-900">{t.plan.title}</h2>
        <div className="flex items-center gap-2">
          {originalUrl && (
            <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-navy-600 hover:bg-navy-50">
              <FileText className="size-4" aria-hidden />
              {t.plan.downloadOriginal}
            </a>
          )}
          <FloorPlanUploader inspectionId={id} propertyId={property.id} userId={user.id} hasPlan={hasPlan} variant={hasPlan ? "secondary" : "accent"} />
        </div>
      </div>

      {hasPlan && imageUrl ? (
        <PlanWorkspace
          inspectionId={id}
          plan={{ url: imageUrl, width: property.floor_plan_width!, height: property.floor_plan_height! }}
          initialDefects={planDefects}
          initialPinId={str(sp.pin)}
          initialFocusId={str(sp.focus)}
          locked={!unlocked}
        />
      ) : (
        <>
          <div className="card flex items-start gap-4 p-5">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-500">
              <MapIcon className="size-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-navy-900">{t.plan.noPlanTitle}</h3>
              <p className="mt-1 text-sm text-navy-500">{t.plan.noPlanBody}</p>
            </div>
          </div>
          <section>
            <h3 className="font-semibold text-navy-900">{t.plan.layoutTitle}</h3>
            <p className="mb-3 text-sm text-navy-500">{t.plan.layoutHint}</p>
            <RoomLayout inspectionId={id} rooms={layoutRooms} t={t} />
          </section>
        </>
      )}
    </div>
  );
}
