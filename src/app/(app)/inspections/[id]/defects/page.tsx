import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Plus, Bug } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";
import { DefectStatusBadge, SeverityBadge } from "@/components/badges";
import { getDefects, getInspection } from "@/lib/data";
import { categoryLabel, formatDate, roomLabel } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { DEFECT_STATUSES, SEVERITIES } from "@/lib/types";
import { DefectFilters } from "./filters";

export const metadata: Metadata = { title: "Defects" };

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export default async function DefectsPage({ params, searchParams }: PageProps<"/inspections/[id]/defects">) {
  const { id } = await params;
  const sp = await searchParams;
  const [{ rooms }, defects, { t, lang }] = await Promise.all([getInspection(id), getDefects(id), getI18n()]);

  const severity = SEVERITIES.find((s) => s === sp.severity);
  const status = DEFECT_STATUSES.find((s) => s === sp.status);
  const room = typeof sp.room === "string" && rooms.some((r) => r.id === sp.room) ? sp.room : undefined;
  const sort = sp.sort === "severity" ? "severity" : "number";

  const filtered = defects
    .filter((d) => (!severity || d.severity === severity) && (!status || d.status === status) && (!room || d.room_id === room))
    .sort((a, b) => (sort === "severity" ? SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.number - b.number : a.number - b.number));
  const roomMap = new Map(rooms.map((r) => [r.id, roomLabel(r, t)]));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DefectFilters rooms={rooms.map((r) => ({ id: r.id, label: roomLabel(r, t) }))} />
        <LinkButton href={`/inspections/${id}/defects/new`} variant="accent">
          <Plus className="size-4" aria-hidden />
          {t.workspace.addDefect}
        </LinkButton>
      </div>

      {defects.length === 0 ? (
        <EmptyState icon={<Bug className="size-7" />} title={t.defect.emptyAll} />
      ) : filtered.length === 0 ? (
        <p className="card p-8 text-center text-navy-500">{t.defect.empty}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <li key={d.id}>
              <Link
                href={`/inspections/${id}/defects/${d.id}`}
                className="card flex flex-col gap-2 p-4 transition hover:border-navy-200 hover:shadow-md hover:shadow-navy-900/5 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-lg bg-navy-900 px-2 py-1 text-xs font-bold text-white" dir="ltr">
                    D-{d.number}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-950">{d.title}</p>
                    <p className="mt-0.5 truncate text-sm text-navy-500">
                      {[d.room_id ? roomMap.get(d.room_id) : t.defect.noRoom, categoryLabel(d.category, t), formatDate(d.identified_on, lang)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 ps-12 sm:ps-0">
                  {d.photoCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-navy-400">
                      <Camera className="size-3.5" aria-hidden />
                      {d.photoCount}
                    </span>
                  )}
                  <SeverityBadge severity={d.severity} t={t} />
                  <DefectStatusBadge status={d.status} t={t} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
