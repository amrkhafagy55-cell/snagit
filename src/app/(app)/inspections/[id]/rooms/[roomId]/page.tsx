import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { LinkButton, ProgressBar } from "@/components/ui";
import { SeverityBadge, DefectStatusBadge } from "@/components/badges";
import { ActionButton } from "@/components/action-buttons";
import { getInspection, getRoomChecklist } from "@/lib/data";
import { formatNumber, roomLabel } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { deleteRoomAction } from "../../../../_actions/inspections";
import { ChecklistBoard } from "./checklist-board";

export default async function RoomPage({ params }: PageProps<"/inspections/[id]/rooms/[roomId]">) {
  const { id, roomId } = await params;
  const [{ rooms }, { t, lang }] = await Promise.all([getInspection(id), getI18n()]);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) notFound();
  const { items, defects } = await getRoomChecklist(id, roomId);

  const done = items.filter((i) => i.result !== "not_inspected").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const idx = rooms.findIndex((r) => r.id === roomId);
  const nextRoom = rooms[idx + 1];
  const defectByItem = Object.fromEntries(
    defects.filter((d) => d.checklist_item_id).map((d) => [d.checklist_item_id as string, { id: d.id, number: d.number }]),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/inspections/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t.workspace.rooms}
      </Link>
      <div className="card sticky top-[4.5rem] z-10 mb-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-navy-950">{roomLabel(room, t)}</h2>
          <LinkButton href={`/inspections/${id}/defects/new?room=${roomId}`} variant="accent" size="sm">
            <Plus className="size-4" aria-hidden />
            {t.workspace.addDefect}
          </LinkButton>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={pct} />
          <span className="shrink-0 text-sm tabular-nums text-navy-500">
            {formatNumber(done, lang)}/{formatNumber(items.length, lang)}
          </span>
        </div>
      </div>

      <ChecklistBoard inspectionId={id} roomId={roomId} initialItems={items} defectByItem={defectByItem} />

      {defects.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 font-semibold text-navy-900">{t.workspace.defects}</h3>
          <ul className="space-y-2">
            {defects.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/inspections/${id}/defects/${d.id}`}
                  className="card flex items-center gap-3 p-3 hover:border-navy-200"
                >
                  <span className="rounded-lg bg-navy-900 px-2 py-1 text-xs font-bold text-white" dir="ltr">
                    D-{d.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{d.title}</span>
                  <SeverityBadge severity={d.severity} t={t} />
                  <span className="hidden sm:inline">
                    <DefectStatusBadge status={d.status} t={t} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-6">
        <ActionButton
          action={deleteRoomAction.bind(null, id, roomId)}
          variant="danger"
          size="sm"
          confirmText={t.workspace.deleteRoomConfirm}
          pendingLabel={t.app.deleting}
        >
          {t.workspace.deleteRoom}
        </ActionButton>
        {nextRoom && (
          <LinkButton href={`/inspections/${id}/rooms/${nextRoom.id}`} variant="primary">
            {roomLabel(nextRoom, t)}
            <ArrowRight className="flip-rtl size-4" aria-hidden />
          </LinkButton>
        )}
      </div>
    </div>
  );
}
