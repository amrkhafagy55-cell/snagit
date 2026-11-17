import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChecklistItem, Defect, DefectPhoto, Inspection, InspectionSummary, Profile, Property, Room,
} from "@/lib/types";

export const MAX_PHOTOS_PER_KIND = 4;

export type ReportPhoto = { kind: "before" | "after"; dataUri: string; takenAt: string };
export type ReportDefect = Defect & { photos: ReportPhoto[] };

export type ReportData = {
  inspection: Inspection;
  property: Property;
  summary: InspectionSummary;
  profile: Profile | null;
  rooms: Room[];
  items: ChecklistItem[];
  defects: ReportDefect[];
  plan: { dataUri: string; width: number; height: number } | null;
};

export class ReportNotFound extends Error {}

const num = (v: unknown) => (v == null ? null : Number(v));

async function toDataUri(supabase: SupabaseClient, bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  const type = data.type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
  return `data:${type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

/** Runs async tasks with a small concurrency limit (storage downloads). */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Loads everything a report needs with the caller's session, so RLS applies. */
export async function collectReportData(supabase: SupabaseClient, inspectionId: string, userId: string): Promise<ReportData> {
  const [insp, summary, profile, rooms, items, defects, photos] = await Promise.all([
    supabase
      .from("inspections")
      .select("id, property_id, inspection_date, inspector_name, status, general_remarks, updated_at, created_at, properties(*)")
      .eq("id", inspectionId)
      .maybeSingle(),
    supabase.from("inspection_summaries").select("*").eq("id", inspectionId).maybeSingle(),
    supabase.from("profiles").select("id, full_name, phone, company, role, locale").eq("id", userId).maybeSingle(),
    supabase.from("rooms").select("id, inspection_id, room_type, type_index, name, sort_order").eq("inspection_id", inspectionId).order("sort_order"),
    supabase
      .from("checklist_items")
      .select("id, room_id, inspection_id, category, title_en, title_ar, result, notes, is_custom, sort_order")
      .eq("inspection_id", inspectionId)
      .order("sort_order"),
    supabase
      .from("defects")
      .select("id, inspection_id, room_id, checklist_item_id, number, title, description, category, severity, status, recommended_action, identified_on, responsible_party, location_note, plan_x, plan_y, reinspection_notes, corrected_on, created_at, updated_at")
      .eq("inspection_id", inspectionId)
      .order("number"),
    supabase
      .from("defect_photos")
      .select("id, defect_id, storage_path, kind, caption, taken_at, defects!inner(inspection_id)")
      .eq("defects.inspection_id", inspectionId)
      .order("taken_at"),
  ]);
  if (!insp.data || !summary.data) throw new ReportNotFound();
  for (const r of [rooms, items, defects, photos]) if (r.error) throw r.error;

  const { properties, ...inspection } = insp.data as unknown as Inspection & { properties: Property };

  // Before photos: the first ones taken; after photos: the most recent ones.
  const byDefect = new Map<string, DefectPhoto[]>();
  for (const p of (photos.data ?? []) as unknown as DefectPhoto[]) {
    if (!byDefect.has(p.defect_id)) byDefect.set(p.defect_id, []);
    byDefect.get(p.defect_id)!.push(p);
  }
  const wanted: DefectPhoto[] = [];
  for (const list of byDefect.values()) {
    wanted.push(...list.filter((p) => p.kind === "before").slice(0, MAX_PHOTOS_PER_KIND));
    wanted.push(...list.filter((p) => p.kind === "after").slice(-MAX_PHOTOS_PER_KIND));
  }

  const [uris, planUri] = await Promise.all([
    pool(wanted, 6, (p) => toDataUri(supabase, "defect-photos", p.storage_path)),
    properties.floor_plan_image_path ? toDataUri(supabase, "floor-plans", properties.floor_plan_image_path) : Promise.resolve(null),
  ]);
  const photoMap = new Map<string, ReportPhoto[]>();
  wanted.forEach((p, i) => {
    const uri = uris[i];
    if (!uri) return;
    if (!photoMap.has(p.defect_id)) photoMap.set(p.defect_id, []);
    photoMap.get(p.defect_id)!.push({ kind: p.kind, dataUri: uri, takenAt: p.taken_at });
  });

  return {
    inspection: inspection as Inspection,
    property: properties,
    summary: summary.data as InspectionSummary,
    profile: (profile.data as Profile | null) ?? null,
    rooms: (rooms.data ?? []) as Room[],
    items: (items.data ?? []) as ChecklistItem[],
    defects: ((defects.data ?? []) as unknown as Defect[]).map((d) => ({
      ...d,
      plan_x: num(d.plan_x),
      plan_y: num(d.plan_y),
      photos: photoMap.get(d.id) ?? [],
    })),
    plan:
      planUri && properties.floor_plan_width && properties.floor_plan_height
        ? { dataUri: planUri, width: properties.floor_plan_width, height: properties.floor_plan_height }
        : null,
  };
}
