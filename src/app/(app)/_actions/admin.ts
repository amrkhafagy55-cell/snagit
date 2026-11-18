"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { ROOM_TYPES, USER_ROLES, type ActionResult } from "@/lib/types";
import { SETTING_KEYS } from "@/lib/settings";
import { ActionError, authed, fail } from "./common";

// Every admin action: verified admin session → RLS-scoped client. The database checks again
// (RLS admin policies / assert_admin() in admin_* functions), so the UI check is not the guard.
async function adminAuthed() {
  const ctx = await authed();
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new ActionError("forbidden");
  return ctx;
}

function adminFail(error: unknown): { ok: false; error: string } {
  const e = (error ?? {}) as { message?: string; code?: string };
  const msg = e.message ?? "";
  if (msg.includes("SNAGIT_FORBIDDEN")) return { ok: false, error: "forbidden" };
  const m = /SNAGIT_ADMIN:(\w+)/.exec(msg);
  if (m) {
    const map: Record<string, string> = { self: "adminSelf", invalid_date: "invalidDate", not_found: "notFound" };
    return { ok: false, error: map[m[1]] ?? "invalid" };
  }
  if (e.code === "23505") return { ok: false, error: "duplicate" };
  if (msg.includes("plans_price_sane")) return { ok: false, error: "invalidPrice" };
  if (e.code === "23514" || e.code === "22P02") return { ok: false, error: "invalid" };
  return fail(error);
}

function done(): ActionResult {
  revalidatePath("/admin", "layout");
  return { ok: true, data: null };
}

/** End of the given calendar day in Cairo, as an ISO timestamp (handles Egypt's summer time). */
function cairoEndOfDay(date: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+02:00";
  return new Date(`${date}T23:59:59${offset === "" ? "+00:00" : offset}`).toISOString();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const uuid = z.uuid();

export async function setUserRoleAction(userId: string, role: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminAuthed();
    const r = z.enum(USER_ROLES).parse(role);
    const { error } = await supabase.rpc("admin_set_role", { p_user: uuid.parse(userId), p_role: r });
    if (error) throw error;
    return done();
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "invalid" };
    return adminFail(e);
  }
}

export async function grantProAction(userId: string, untilDate: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminAuthed();
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(untilDate);
    const { error } = await supabase.rpc("admin_grant_pro", { p_user: uuid.parse(userId), p_until: cairoEndOfDay(date) });
    if (error) throw error;
    return done();
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "invalidDate" };
    return adminFail(e);
  }
}

export async function cancelProAction(userId: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminAuthed();
    const { error } = await supabase.rpc("admin_cancel_pro", { p_user: uuid.parse(userId) });
    if (error) throw error;
    return done();
  } catch (e) {
    return adminFail(e);
  }
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
const optionalLimit = z
  .string()
  .trim()
  .regex(/^(\d{1,4})?$/)
  .transform((s) => (s === "" ? null : Number(s)))
  .refine((n) => n === null || n > 0);

const planSchema = z.object({
  id: z.enum(["free", "pro_annual", "report"]),
  name_en: z.string().trim().min(1).max(60),
  name_ar: z.string().trim().min(1).max(60),
  price: z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/),
  max_active_inspections: optionalLimit,
  max_defects_per_inspection: optionalLimit,
  is_active: z.boolean(),
});

export async function updatePlanAction(raw: z.input<typeof planSchema>): Promise<ActionResult> {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };
  const v = parsed.data;
  try {
    const { supabase } = await adminAuthed();
    const price_cents = v.id === "free" ? 0 : Math.round(Number(v.price) * 100);
    if (v.id !== "free" && price_cents < 100) throw new ActionError("invalidPrice");
    const { data, error } = await supabase
      .from("plans")
      .update({
        name_en: v.name_en,
        name_ar: v.name_ar,
        price_cents,
        max_active_inspections: v.max_active_inspections,
        max_defects_per_inspection: v.max_defects_per_inspection,
        is_active: v.id === "free" ? true : v.is_active,
      })
      .eq("id", v.id)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new ActionError("forbidden");
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return adminFail(e);
  }
}

// ---------------------------------------------------------------------------
// Checklist templates
// ---------------------------------------------------------------------------
const templateSchema = z.object({
  id: z.uuid().nullable(),
  room_type: z.enum(ROOM_TYPES),
  category: z.string().trim().regex(/^[a-z][a-z0-9_]{1,39}$/),
  title_en: z.string().trim().min(1).max(200),
  title_ar: z.string().trim().min(1).max(200),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

export async function saveTemplateAction(raw: z.input<typeof templateSchema>): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { id, ...v } = parsed.data;
  try {
    const { supabase } = await adminAuthed();
    const q = id
      ? supabase.from("checklist_templates").update(v).eq("id", id).select("id")
      : supabase.from("checklist_templates").insert({ ...v, is_active: true }).select("id");
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) throw new ActionError("forbidden");
    return done();
  } catch (e) {
    return adminFail(e);
  }
}

export async function setTemplateActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await adminAuthed();
    const { data, error } = await supabase.from("checklist_templates").update({ is_active: active }).eq("id", uuid.parse(id)).select("id");
    if (error) throw error;
    if (!data?.length) throw new ActionError("forbidden");
    return done();
  } catch (e) {
    return adminFail(e);
  }
}

// ---------------------------------------------------------------------------
// Defect categories
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,39}$/),
  name_en: z.string().trim().min(1).max(60),
  name_ar: z.string().trim().min(1).max(60),
  sort_order: z.coerce.number().int().min(0).max(9999),
  isNew: z.boolean(),
});

export async function saveCategoryAction(raw: z.input<typeof categorySchema>): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    const keyIssue = parsed.error.issues.some((i) => i.path[0] === "key");
    return { ok: false, error: keyIssue ? "invalidKey" : "validation" };
  }
  const { isNew, key, ...v } = parsed.data;
  try {
    const { supabase } = await adminAuthed();
    const q = isNew
      ? supabase.from("defect_categories").insert({ key, ...v }).select("key")
      : supabase.from("defect_categories").update(v).eq("key", key).select("key");
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) throw new ActionError("forbidden");
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return adminFail(e);
  }
}

export async function setCategoryActiveAction(key: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await adminAuthed();
    const { data, error } = await supabase.from("defect_categories").update({ is_active: active }).eq("key", key).select("key");
    if (error) throw error;
    if (!data?.length) throw new ActionError("forbidden");
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return adminFail(e);
  }
}

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------
const settingsSchema = z.object({
  announcement_en: z.string().trim().max(300),
  announcement_ar: z.string().trim().max(300),
  support_email: z.union([z.literal(""), z.email().max(200)]),
  support_whatsapp: z.string().trim().regex(/^(\+?\d{8,15})?$/),
  ai_daily_limit: z.string().trim().regex(/^([1-9]\d{0,3})?$/),
});

export async function updateSettingsAction(raw: z.input<typeof settingsSchema>): Promise<ActionResult<null>> {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), "invalid"])),
    };
  }
  try {
    const { supabase } = await adminAuthed();
    const { data: current, error: readErr } = await supabase.from("app_settings").select("key, value");
    if (readErr) throw readErr;
    const before = new Map((current ?? []).map((r) => [r.key as string, r.value as string]));
    for (const key of SETTING_KEYS) {
      const value = parsed.data[key];
      if (before.get(key) === value) continue;
      const { data, error } = await supabase.from("app_settings").update({ value }).eq("key", key).select("key");
      if (error) throw error;
      if (!data?.length) throw new ActionError("forbidden");
    }
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return adminFail(e);
  }
}
