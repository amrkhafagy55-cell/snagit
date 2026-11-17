import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
import { Alert, LinkButton } from "@/components/ui";
import { DefectStatusBadge, SeverityBadge } from "@/components/badges";
import { ActionButton } from "@/components/action-buttons";
import { requireUser } from "@/lib/auth";
import { getDefect, getInspection, getPlanImageUrl } from "@/lib/data";
import { MARKER_COLORS } from "@/components/plan/marker-colors";
import { categoryLabel, formatDate, roomLabel } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { deleteDefectAction } from "../../../../_actions/defects";
import { PhotoGallery, PhotoUploader, ReinspectionForm } from "./client";

export const metadata: Metadata = { title: "Defect" };

export default async function DefectPage({ params, searchParams }: PageProps<"/inspections/[id]/defects/[defectId]">) {
  const { id, defectId } = await params;
  const sp = await searchParams;
  const [user, { rooms, property }, { defect, photos }, { t, lang }] = await Promise.all([
    requireUser(),
    getInspection(id),
    getDefect(id, defectId),
    getI18n(),
  ]);
  const room = rooms.find((r) => r.id === defect.room_id);
  const planUrl = property.floor_plan_width && property.floor_plan_height ? await getPlanImageUrl(property) : null;
  const pinned = defect.plan_x !== null && defect.plan_y !== null;
  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");

  const facts: [string, string][] = [
    [t.defect.room, room ? roomLabel(room, t) : t.defect.noRoom],
    [t.defect.locationNote, defect.location_note],
    [t.defect.category, categoryLabel(defect.category, t)],
    [t.defect.identified, formatDate(defect.identified_on, lang)],
    [t.defect.responsible, defect.responsible_party],
    [t.defect.correctedOn, defect.corrected_on ? formatDate(defect.corrected_on, lang) : ""],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/inspections/${id}/defects`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t.defect.listTitle}
      </Link>

      {sp.upload === "failed" && (
        <div className="mb-4">
          <Alert>{t.errors.uploadFailed}</Alert>
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-navy-900 px-2 py-1 text-xs font-bold text-white" dir="ltr">
                D-{defect.number}
              </span>
              <SeverityBadge severity={defect.severity} t={t} />
              <DefectStatusBadge status={defect.status} t={t} />
            </div>
            <h2 className="mt-3 text-2xl font-bold text-navy-950">{defect.title}</h2>
          </div>
          <LinkButton href={`/inspections/${id}/defects/${defectId}/edit`} variant="secondary" size="sm">
            <Pencil className="size-4" aria-hidden />
            {t.app.edit}
          </LinkButton>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-navy-400">{k}</dt>
                <dd className="font-medium text-navy-900">{v}</dd>
              </div>
            ))}
        </dl>

        {defect.description && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-navy-500">{t.defect.description}</h3>
            <p className="mt-1 whitespace-pre-line text-navy-800">{defect.description}</p>
          </div>
        )}
        {defect.recommended_action && (
          <div className="mt-4 rounded-xl border-s-4 border-accent-500 bg-accent-50/60 p-4">
            <h3 className="text-sm font-semibold text-accent-700">{t.defect.action}</h3>
            <p className="mt-1 whitespace-pre-line text-navy-800">{defect.recommended_action}</p>
          </div>
        )}
      </div>

      {planUrl && (
        <section className="card mt-6 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-navy-900">{t.plan.title}</h3>
            <LinkButton
              href={`/inspections/${id}/plan?${pinned ? "focus" : "pin"}=${defectId}`}
              variant={pinned ? "secondary" : "accent"}
              size="sm"
            >
              <MapPin className="size-4" aria-hidden />
              {pinned ? t.plan.viewOnPlan : t.plan.pinOnPlan}
            </LinkButton>
          </div>
          {pinned && (
            <Link href={`/inspections/${id}/plan?focus=${defectId}`} className="block overflow-hidden rounded-xl ring-1 ring-navy-100">
              {/* Cap the height via max-width so the box keeps the plan's aspect ratio and % pins stay exact. */}
              <div
                className="relative mx-auto w-full bg-white"
                style={{
                  aspectRatio: `${property.floor_plan_width} / ${property.floor_plan_height}`,
                  maxWidth: `${Math.round((320 * property.floor_plan_width!) / property.floor_plan_height!)}px`,
                }}
                dir="ltr"
              >
                <img src={planUrl} alt={t.plan.title} className="absolute inset-0 size-full" />
                <span
                  className={`absolute grid h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-1.5 text-xs font-bold shadow-md ring-2 ring-white ${MARKER_COLORS[defect.severity]}`}
                  style={{ left: `${defect.plan_x! * 100}%`, top: `${defect.plan_y! * 100}%` }}
                >
                  {defect.number}
                </span>
              </div>
            </Link>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-3 font-semibold text-navy-900">
            {t.defect.beforePhotos} <span className="text-navy-400">({before.length})</span>
          </h3>
          <PhotoGallery photos={before} emptyText={t.defect.noPhotos} />
          <PhotoUploader userId={user.id} inspectionId={id} defectId={defectId} kind="before" label={t.defect.addPhotos} />
        </section>
        <section className="card p-5">
          <h3 className="mb-3 font-semibold text-navy-900">
            {t.defect.afterPhotos} <span className="text-navy-400">({after.length})</span>
          </h3>
          <PhotoGallery photos={after} emptyText={t.defect.noPhotos} />
          <PhotoUploader userId={user.id} inspectionId={id} defectId={defectId} kind="after" label={t.defect.addPhotos} />
        </section>
      </div>

      {before[0]?.url && after.at(-1)?.url && (
        <section className="card mt-6 p-5">
          <h3 className="mb-3 font-semibold text-navy-900">{t.defect.compare}</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t.defect.beforePhotos, src: before[0].url! },
              { label: t.defect.afterPhotos, src: after.at(-1)!.url! },
            ].map((p) => (
              <figure key={p.label}>
                <img src={p.src} alt={p.label} className="aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-navy-100" />
                <figcaption className="mt-1.5 text-center text-xs font-semibold text-navy-500">{p.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-6 p-5 sm:p-6">
        <h3 className="mb-4 font-semibold text-navy-900">{t.defect.reinspection}</h3>
        <ReinspectionForm
          defectId={defectId}
          initial={{ status: defect.status, reinspectionNotes: defect.reinspection_notes, correctedOn: defect.corrected_on }}
        />
      </section>

      <div className="mt-8 border-t border-navy-100 pt-6">
        <ActionButton
          action={deleteDefectAction.bind(null, id, defectId)}
          variant="danger"
          size="sm"
          confirmText={t.app.areYouSure}
          pendingLabel={t.app.deleting}
        >
          {t.defect.deleteDefect}
        </ActionButton>
      </div>
    </div>
  );
}
