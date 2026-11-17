import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCategories, getChecklistItem, getInspection } from "@/lib/data";
import { itemTitle, roomLabel, todayIso } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { isAiEnabled } from "@/lib/ai/defect-assistant";
import { DefectForm } from "../defect-form";

export const metadata: Metadata = { title: "Register defect" };

export default async function NewDefectPage({ params, searchParams }: PageProps<"/inspections/[id]/defects/new">) {
  const { id } = await params;
  const sp = await searchParams;
  const roomParam = typeof sp.room === "string" ? sp.room : null;
  const itemParam = typeof sp.item === "string" ? sp.item : null;
  const coord = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
  };
  const planX = coord(sp.x);
  const planY = planX === null ? null : coord(sp.y);
  const fromPlan = sp.from === "plan" && planY !== null;

  const [user, { rooms }, categories, item, { t, lang }] = await Promise.all([
    requireUser(),
    getInspection(id),
    getCategories(id),
    itemParam ? getChecklistItem(itemParam) : Promise.resolve(null),
    getI18n(),
  ]);
  const linkedItem = item && item.inspection_id === id ? item : null;
  const roomId = linkedItem?.room_id ?? (rooms.some((r) => r.id === roomParam) ? roomParam : null);
  const room = rooms.find((r) => r.id === roomId);
  const back = fromPlan ? `/inspections/${id}/plan` : room ? `/inspections/${id}/rooms/${room.id}` : `/inspections/${id}/defects`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {fromPlan ? t.plan.title : room ? roomLabel(room, t) : t.defect.listTitle}
      </Link>
      <h2 className="mb-5 text-xl font-bold text-navy-950">{t.defect.newTitle}</h2>
      <DefectForm
        mode="create"
        inspectionId={id}
        userId={user.id}
        rooms={rooms.map((r) => ({ id: r.id, label: roomLabel(r, t) }))}
        categories={categories}
        linkedItemTitle={linkedItem ? itemTitle(linkedItem, lang) : undefined}
        returnToPlan={fromPlan}
        aiEnabled={isAiEnabled()}
        initial={{
          roomId,
          checklistItemId: linkedItem?.id ?? null,
          title: linkedItem ? itemTitle(linkedItem, lang) : "",
          description: linkedItem?.notes ?? "",
          category: linkedItem?.category ?? "architectural",
          severity: "medium",
          status: "open",
          recommendedAction: "",
          identifiedOn: todayIso(),
          responsibleParty: "",
          locationNote: "",
          planX: planY === null ? null : planX,
          planY,
        }}
      />
    </div>
  );
}
