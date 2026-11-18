import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCategoryKeys } from "@/lib/categories";
import {
  type ChecklistItem, type Defect, type DefectPhoto, type Inspection, type InspectionSummary, type Property, type Room,
} from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(id: string) {
  if (!UUID_RE.test(id)) notFound();
}

const DEFECT_COLUMNS =
  "id, inspection_id, room_id, checklist_item_id, number, title, description, category, severity, status, recommended_action, identified_on, responsible_party, location_note, plan_x, plan_y, reinspection_notes, corrected_on, created_at, updated_at";

/** numeric columns may arrive as strings from PostgREST; normalise pin coordinates. */
function normDefect<T extends { plan_x: unknown; plan_y: unknown }>(d: T): T & { plan_x: number | null; plan_y: number | null } {
  const x = d.plan_x == null ? null : Number(d.plan_x);
  const y = d.plan_y == null ? null : Number(d.plan_y);
  return { ...d, plan_x: x, plan_y: y };
}
const ITEM_COLUMNS = "id, room_id, inspection_id, category, title_en, title_ar, result, notes, is_custom, sort_order";

export async function getInspectionSummaries(): Promise<InspectionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_summaries")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as InspectionSummary[];
}

/** Inspection + property + rooms + summary. Cached per request (layout and page share it). */
export const getInspection = cache(async (id: string) => {
  assertUuid(id);
  const supabase = await createClient();
  const [{ data: inspection }, { data: summary }, { data: rooms }] = await Promise.all([
    supabase
      .from("inspections")
      .select("id, property_id, inspection_date, inspector_name, status, general_remarks, updated_at, created_at, properties(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("inspection_summaries").select("*").eq("id", id).maybeSingle(),
    supabase.from("rooms").select("id, inspection_id, room_type, type_index, name, sort_order").eq("inspection_id", id).order("sort_order"),
  ]);
  if (!inspection || !summary) notFound();
  const { properties, ...rest } = inspection as unknown as Inspection & { properties: Property };
  return {
    inspection: rest as Inspection,
    property: properties,
    summary: summary as InspectionSummary,
    rooms: (rooms ?? []) as Room[],
  };
});

/** Per-room counts for the rooms grid. */
export async function getRoomProgress(inspectionId: string) {
  const supabase = await createClient();
  const [{ data: items }, { data: defects }] = await Promise.all([
    supabase.from("checklist_items").select("room_id, result").eq("inspection_id", inspectionId),
    supabase.from("defects").select("room_id, status").eq("inspection_id", inspectionId),
  ]);
  const map = new Map<string, { total: number; done: number; failed: number; defects: number }>();
  const get = (id: string) => {
    if (!map.has(id)) map.set(id, { total: 0, done: 0, failed: 0, defects: 0 });
    return map.get(id)!;
  };
  for (const it of items ?? []) {
    const r = get(it.room_id as string);
    r.total++;
    if (it.result !== "not_inspected") r.done++;
    if (it.result === "failed") r.failed++;
  }
  for (const d of defects ?? []) {
    if (d.room_id && d.status !== "resolved" && d.status !== "rejected") get(d.room_id as string).defects++;
  }
  return map;
}

export async function getRoomChecklist(inspectionId: string, roomId: string) {
  assertUuid(roomId);
  const supabase = await createClient();
  const [{ data: items }, { data: defects }] = await Promise.all([
    supabase.from("checklist_items").select(ITEM_COLUMNS).eq("room_id", roomId).eq("inspection_id", inspectionId).order("sort_order"),
    supabase
      .from("defects")
      .select("id, number, checklist_item_id, severity, status, title")
      .eq("inspection_id", inspectionId)
      .eq("room_id", roomId)
      .order("number"),
  ]);
  return {
    items: (items ?? []) as ChecklistItem[],
    defects: (defects ?? []) as Pick<Defect, "id" | "number" | "checklist_item_id" | "severity" | "status" | "title">[],
  };
}

export async function getChecklistItem(itemId: string) {
  if (!UUID_RE.test(itemId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("checklist_items").select(ITEM_COLUMNS).eq("id", itemId).maybeSingle();
  return (data as ChecklistItem | null) ?? null;
}

export async function getDefects(inspectionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("defects")
    .select(`${DEFECT_COLUMNS}, defect_photos(count)`)
    .eq("inspection_id", inspectionId)
    .order("number");
  if (error) throw error;
  return (data ?? []).map((d) => {
    const { defect_photos, ...rest } = d as unknown as Defect & { defect_photos: { count: number }[] };
    return { ...normDefect(rest as Defect), photoCount: defect_photos?.[0]?.count ?? 0 };
  });
}

export async function getDefect(inspectionId: string, defectId: string) {
  assertUuid(defectId);
  const supabase = await createClient();
  const [{ data: defect }, { data: photos }] = await Promise.all([
    supabase.from("defects").select(DEFECT_COLUMNS).eq("id", defectId).eq("inspection_id", inspectionId).maybeSingle(),
    supabase
      .from("defect_photos")
      .select("id, defect_id, storage_path, kind, caption, taken_at")
      .eq("defect_id", defectId)
      .order("taken_at"),
  ]);
  if (!defect) notFound();
  const list = (photos ?? []) as DefectPhoto[];
  const urls = await signedUrls("defect-photos", list.map((p) => p.storage_path));
  return { defect: normDefect(defect as Defect), photos: list.map((p) => ({ ...p, url: urls.get(p.storage_path) ?? null })) };
}

/** Active admin-managed categories first, then any other ones already used in this inspection. */
export async function getCategories(inspectionId: string) {
  const supabase = await createClient();
  const [{ data: items }, { data: defects }, active] = await Promise.all([
    supabase.from("checklist_items").select("category").eq("inspection_id", inspectionId),
    supabase.from("defects").select("category").eq("inspection_id", inspectionId),
    getActiveCategoryKeys(),
  ]);
  const used = [...(items ?? []), ...(defects ?? [])].map((r) => r.category as string);
  return [...new Set([...active, ...used])];
}

export async function signedUrls(bucket: string, paths: string[], expiresIn = 3600) {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

/** Signed URL of the plan image (null when the property has no displayable plan). */
export async function getPlanImageUrl(property: Property) {
  if (!property.floor_plan_image_path) return null;
  return (await signedUrls("floor-plans", [property.floor_plan_image_path])).get(property.floor_plan_image_path) ?? null;
}

export function completion(s: Pick<InspectionSummary, "items_total" | "items_passed" | "items_failed">) {
  return s.items_total ? Math.round(((s.items_passed + s.items_failed) / s.items_total) * 100) : 0;
}
