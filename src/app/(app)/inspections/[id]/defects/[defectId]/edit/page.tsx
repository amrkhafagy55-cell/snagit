import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCategories, getDefect, getInspection } from "@/lib/data";
import { roomLabel } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { isAiEnabled } from "@/lib/ai/defect-assistant";
import { DefectForm } from "../../defect-form";

export const metadata: Metadata = { title: "Edit defect" };

export default async function EditDefectPage({ params }: PageProps<"/inspections/[id]/defects/[defectId]/edit">) {
  const { id, defectId } = await params;
  const [user, { rooms }, categories, { defect, photos }, { t }] = await Promise.all([
    requireUser(),
    getInspection(id),
    getCategories(id),
    getDefect(id, defectId),
    getI18n(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/inspections/${id}/defects/${defectId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900"
      >
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        <span dir="ltr">D-{defect.number}</span>
      </Link>
      <h2 className="mb-5 text-xl font-bold text-navy-950">{t.defect.editTitle}</h2>
      <DefectForm
        mode="edit"
        inspectionId={id}
        userId={user.id}
        defectId={defectId}
        aiEnabled={isAiEnabled()}
        storedPhotoCount={photos.length}
        rooms={rooms.map((r) => ({ id: r.id, label: roomLabel(r, t) }))}
        categories={categories}
        initial={{
          roomId: defect.room_id,
          checklistItemId: defect.checklist_item_id,
          title: defect.title,
          description: defect.description,
          category: defect.category,
          severity: defect.severity,
          status: defect.status,
          recommendedAction: defect.recommended_action,
          identifiedOn: defect.identified_on,
          responsibleParty: defect.responsible_party,
          locationNote: defect.location_note,
        }}
      />
    </div>
  );
}
