"use server";
import { revalidatePath } from "next/cache";
import { checklistNoteSchema, checklistResultSchema, customItemSchema, fieldErrors } from "@/lib/validation";
import type { ActionResult, ChecklistItem } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

export async function setChecklistResultAction(itemId: string, result: string): Promise<ActionResult> {
  const parsed = checklistResultSchema.safeParse({ itemId, result });
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ result: parsed.data.result })
      .eq("id", itemId)
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

export async function saveChecklistNoteAction(itemId: string, notes: string): Promise<ActionResult> {
  const parsed = checklistNoteSchema.safeParse({ itemId, notes });
  if (!parsed.success) return { ok: false, error: "tooLong" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase.from("checklist_items").update({ notes: parsed.data.notes }).eq("id", itemId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function addChecklistItemAction(
  roomId: string,
  category: string,
  title: string,
): Promise<ActionResult<ChecklistItem>> {
  const parsed = customItemSchema.safeParse({ roomId, category, title });
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
  try {
    const { supabase } = await authed();
    const { data: room } = await supabase.from("rooms").select("id, inspection_id").eq("id", roomId).maybeSingle();
    if (!room) throw new ActionError("notFound");
    const { data: last } = await supabase
      .from("checklist_items")
      .select("sort_order")
      .eq("room_id", roomId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({
        room_id: roomId,
        inspection_id: room.inspection_id,
        category: parsed.data.category.toLowerCase() in STANDARD ? parsed.data.category.toLowerCase() : parsed.data.category,
        title_en: parsed.data.title,
        title_ar: parsed.data.title,
        is_custom: true,
        sort_order: (last?.sort_order ?? 0) + 1,
      })
      .select("id, room_id, inspection_id, category, title_en, title_ar, result, notes, is_custom, sort_order")
      .single();
    if (error) throw error;
    revalidatePath(`/inspections/${room.inspection_id}`, "layout");
    return { ok: true, data: data as ChecklistItem };
  } catch (e) {
    return fail(e);
  }
}

const STANDARD = { architectural: 1, electrical: 1, plumbing: 1, mechanical: 1 };

export async function deleteChecklistItemAction(itemId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", itemId)
      .select("inspection_id")
      .maybeSingle();
    if (error) throw error;
    if (data) revalidatePath(`/inspections/${data.inspection_id}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
