"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defectSchema, fieldErrors, reinspectionSchema, type DefectInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

function toRow(v: DefectInput) {
  // Pins are only written when the form sends them (new defect placed from the plan);
  // editing a defect never clears an existing pin.
  const pin = v.planX != null && v.planY != null ? { plan_x: v.planX, plan_y: v.planY } : {};
  return {
    ...pin,
    room_id: v.roomId,
    checklist_item_id: v.checklistItemId,
    title: v.title,
    description: v.description,
    category: v.category,
    severity: v.severity,
    status: v.status,
    recommended_action: v.recommendedAction,
    identified_on: v.identifiedOn,
    responsible_party: v.responsibleParty,
    location_note: v.locationNote,
  };
}

export async function createDefectAction(input: DefectInput): Promise<ActionResult<{ defectId: string; number: number }>> {
  const parsed = defectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("defects")
      .insert({ inspection_id: parsed.data.inspectionId, ...toRow(parsed.data) })
      .select("id, number")
      .single();
    if (error) throw error;
    // A defect registered from a checklist item marks that item as failed.
    if (parsed.data.checklistItemId) {
      await supabase.from("checklist_items").update({ result: "failed" }).eq("id", parsed.data.checklistItemId);
    }
    revalidatePath(`/inspections/${parsed.data.inspectionId}`, "layout");
    revalidatePath("/dashboard");
    return { ok: true, data: { defectId: data.id, number: data.number } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateDefectAction(defectId: string, input: DefectInput): Promise<ActionResult> {
  const parsed = defectSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(defectId).success) {
    return { ok: false, error: "validation", fieldErrors: parsed.success ? {} : fieldErrors(parsed.error) };
  }
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("defects")
      .update(toRow(parsed.data))
      .eq("id", defectId)
      .eq("inspection_id", parsed.data.inspectionId);
    if (error) throw error;
    revalidatePath(`/inspections/${parsed.data.inspectionId}`, "layout");
    revalidatePath("/dashboard");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function updateReinspectionAction(input: z.infer<typeof reinspectionSchema>): Promise<ActionResult> {
  const parsed = reinspectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("defects")
      .update({
        status: parsed.data.status,
        reinspection_notes: parsed.data.reinspectionNotes,
        corrected_on: parsed.data.correctedOn,
      })
      .eq("id", parsed.data.defectId)
      .select("inspection_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("notFound");
    revalidatePath(`/inspections/${data.inspection_id}`, "layout");
    revalidatePath("/dashboard");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDefectAction(inspectionId: string, defectId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authed();
    const { data: photos } = await supabase.from("defect_photos").select("storage_path").eq("defect_id", defectId);
    const paths = (photos ?? []).map((p) => p.storage_path as string);
    if (paths.length) await supabase.storage.from("defect-photos").remove(paths);
    const { error } = await supabase.from("defects").delete().eq("id", defectId).eq("inspection_id", inspectionId);
    if (error) throw error;
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/inspections/${inspectionId}`, "layout");
  revalidatePath("/dashboard");
  redirect(`/inspections/${inspectionId}/defects`);
}

const photoSchema = z.object({
  path: z.string().min(1).max(500),
  kind: z.enum(["before", "after"]),
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
});

/** Records photos that the browser already uploaded to the user's own storage folder. */
export async function registerPhotosAction(
  defectId: string,
  photos: z.infer<typeof photoSchema>[],
): Promise<ActionResult> {
  const parsed = z.array(photoSchema).min(1).max(20).safeParse(photos);
  if (!parsed.success || !z.uuid().safeParse(defectId).success) return { ok: false, error: "invalid" };
  try {
    const { user, supabase } = await authed();
    const { data: defect } = await supabase.from("defects").select("id, inspection_id").eq("id", defectId).maybeSingle();
    if (!defect) throw new ActionError("notFound");
    const prefix = `${user.id}/${defect.inspection_id}/${defectId}/`;
    if (parsed.data.some((p) => !p.path.startsWith(prefix) || p.path.includes(".."))) throw new ActionError("invalid");
    const { error } = await supabase.from("defect_photos").insert(
      parsed.data.map((p) => ({ defect_id: defectId, storage_path: p.path, kind: p.kind, width: p.width, height: p.height })),
    );
    if (error) throw error;
    revalidatePath(`/inspections/${defect.inspection_id}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePhotoAction(photoId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authed();
    const { data: photo } = await supabase
      .from("defect_photos")
      .select("id, storage_path, defects(inspection_id)")
      .eq("id", photoId)
      .maybeSingle();
    if (!photo) throw new ActionError("notFound");
    await supabase.storage.from("defect-photos").remove([photo.storage_path]);
    const { error } = await supabase.from("defect_photos").delete().eq("id", photoId);
    if (error) throw error;
    const inspectionId = (photo.defects as unknown as { inspection_id: string } | null)?.inspection_id;
    if (inspectionId) revalidatePath(`/inspections/${inspectionId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
