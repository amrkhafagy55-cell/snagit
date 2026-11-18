"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addRoomSchema, createPropertySchema, fieldErrors, inspectionStatusSchema, remarksSchema,
  type CreatePropertyInput,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

export async function createPropertyAction(input: CreatePropertyInput): Promise<ActionResult<{ inspectionId: string }>> {
  const parsed = createPropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const { user, supabase } = await authed();
    const plan = v.floorPlan;
    const folder = `${user.id}/${v.propertyId}/`;
    if (plan && [plan.floorPlanPath, plan.floorPlanImagePath].some((p) => !p.startsWith(folder) || p.includes(".."))) {
      throw new ActionError("invalid");
    }

    const { error: pErr } = await supabase.from("properties").insert({
      id: v.propertyId,
      project_name: v.projectName,
      developer_name: v.developerName,
      address: v.address,
      building_number: v.buildingNumber,
      apartment_number: v.apartmentNumber,
      floor_number: v.floorNumber,
      property_type: v.propertyType,
      bedrooms: v.bedrooms,
      bathrooms: v.bathrooms,
      owner_name: v.ownerName,
      notes: v.notes,
      floor_plan_path: plan?.floorPlanPath ?? null,
      floor_plan_mime: plan?.floorPlanMime ?? null,
      floor_plan_image_path: plan?.floorPlanImagePath ?? null,
      floor_plan_width: plan?.floorPlanWidth ?? null,
      floor_plan_height: plan?.floorPlanHeight ?? null,
    });
    if (pErr) throw pErr;

    const { data: insp, error: iErr } = await supabase
      .from("inspections")
      .insert({
        property_id: v.propertyId,
        inspection_date: v.inspectionDate,
        inspector_name: v.inspectorName,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (iErr || !insp) {
      await supabase.from("properties").delete().eq("id", v.propertyId);
      throw iErr ?? new Error("inspection insert failed");
    }

    const { error: rErr } = await supabase.rpc("initialize_inspection", {
      p_inspection_id: insp.id,
      p_bedrooms: v.bedrooms,
      p_bathrooms: v.bathrooms,
      p_balconies: v.balconies,
      p_has_roof: v.hasRoof,
    });
    if (rErr) {
      await supabase.from("properties").delete().eq("id", v.propertyId);
      throw rErr;
    }

    revalidatePath("/dashboard");
    return { ok: true, data: { inspectionId: insp.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function setInspectionStatusAction(inspectionId: string, status: string): Promise<ActionResult> {
  const parsed = inspectionStatusSchema.safeParse({ inspectionId, status });
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("inspections")
      .update({
        status: parsed.data.status,
        completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", inspectionId);
    if (error) throw error;
    revalidatePath(`/inspections/${inspectionId}`, "layout");
    revalidatePath("/dashboard");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function saveRemarksAction(inspectionId: string, remarks: string): Promise<ActionResult> {
  const parsed = remarksSchema.safeParse({ inspectionId, remarks });
  if (!parsed.success) return { ok: false, error: "tooLong" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("inspections")
      .update({ general_remarks: parsed.data.remarks })
      .eq("id", inspectionId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Deletes the inspection, its files, and the property when no other inspection uses it. */
export async function deleteInspectionAction(inspectionId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authed();
    const { data: insp } = await supabase
      .from("inspections")
      .select("id, property_id, properties(floor_plan_path, floor_plan_image_path)")
      .eq("id", inspectionId)
      .maybeSingle();
    if (!insp) throw new ActionError("notFound");

    const { data: photos } = await supabase
      .from("defect_photos")
      .select("storage_path, defects!inner(inspection_id)")
      .eq("defects.inspection_id", inspectionId);
    const photoPaths = (photos ?? []).map((p) => p.storage_path as string);
    for (let i = 0; i < photoPaths.length; i += 100) {
      await supabase.storage.from("defect-photos").remove(photoPaths.slice(i, i + 100));
    }
    // Report PDFs too: the rows cascade, but the files would otherwise stay in storage.
    const { data: reports } = await supabase.from("reports").select("storage_path").eq("inspection_id", inspectionId);
    const reportPaths = (reports ?? []).map((r) => r.storage_path as string);
    for (let i = 0; i < reportPaths.length; i += 100) {
      await supabase.storage.from("reports").remove(reportPaths.slice(i, i + 100));
    }

    const { error } = await supabase.from("inspections").delete().eq("id", inspectionId);
    if (error) throw error;

    const { count } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("property_id", insp.property_id);
    if (!count) {
      const prop = insp.properties as unknown as { floor_plan_path: string | null; floor_plan_image_path: string | null } | null;
      const files = [...new Set([prop?.floor_plan_path, prop?.floor_plan_image_path].filter(Boolean) as string[])];
      if (files.length) await supabase.storage.from("floor-plans").remove(files);
      await supabase.from("properties").delete().eq("id", insp.property_id);
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function addRoomAction(inspectionId: string, roomType: string, name: string): Promise<ActionResult<{ roomId: string }>> {
  const parsed = addRoomSchema.safeParse({ inspectionId, roomType, name });
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase.rpc("add_room", {
      p_inspection_id: inspectionId,
      p_room_type: parsed.data.roomType,
      p_name: parsed.data.name || null,
    });
    if (error) throw error;
    revalidatePath(`/inspections/${inspectionId}`, "layout");
    return { ok: true, data: { roomId: data as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRoomAction(inspectionId: string, roomId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authed();
    const { error } = await supabase.from("rooms").delete().eq("id", roomId).eq("inspection_id", inspectionId);
    if (error) throw error;
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/inspections/${inspectionId}`, "layout");
  redirect(`/inspections/${inspectionId}`);
}
