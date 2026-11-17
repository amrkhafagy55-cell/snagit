"use server";
import { revalidatePath } from "next/cache";
import { floorPlanSchema, pinSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

/** Places, moves (x/y) or removes (null/null) a defect's marker on the floor plan. */
export async function setDefectPinAction(defectId: string, x: number | null, y: number | null): Promise<ActionResult> {
  const round = (n: number | null) => (n === null ? null : Math.round(Math.min(1, Math.max(0, n)) * 100000) / 100000);
  const parsed = pinSchema.safeParse({ defectId, x: round(x), y: round(y) });
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("defects")
      .update({ plan_x: parsed.data.x, plan_y: parsed.data.y })
      .eq("id", defectId)
      .select("inspection_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("notFound");
    revalidatePath(`/inspections/${data.inspection_id}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Saves a newly uploaded floor plan on the inspection's property and deletes the old files. Pins are kept. */
export async function replaceFloorPlanAction(input: unknown): Promise<ActionResult> {
  const parsed = floorPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  try {
    const { user, supabase } = await authed();
    const { data: insp } = await supabase
      .from("inspections")
      .select("id, property_id, properties(floor_plan_path, floor_plan_image_path)")
      .eq("id", v.inspectionId)
      .maybeSingle();
    if (!insp) throw new ActionError("notFound");
    const folder = `${user.id}/${insp.property_id}/`;
    if ([v.floorPlanPath, v.floorPlanImagePath].some((p) => !p.startsWith(folder) || p.includes(".."))) {
      throw new ActionError("invalid");
    }
    const old = insp.properties as unknown as { floor_plan_path: string | null; floor_plan_image_path: string | null } | null;

    const { error } = await supabase
      .from("properties")
      .update({
        floor_plan_path: v.floorPlanPath,
        floor_plan_mime: v.floorPlanMime,
        floor_plan_image_path: v.floorPlanImagePath,
        floor_plan_width: v.floorPlanWidth,
        floor_plan_height: v.floorPlanHeight,
      })
      .eq("id", insp.property_id);
    if (error) throw error;

    const stale = [old?.floor_plan_path, old?.floor_plan_image_path].filter(
      (p): p is string => Boolean(p) && p !== v.floorPlanPath && p !== v.floorPlanImagePath,
    );
    if (stale.length) await supabase.storage.from("floor-plans").remove([...new Set(stale)]);

    revalidatePath(`/inspections/${v.inspectionId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
