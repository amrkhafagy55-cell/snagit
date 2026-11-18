import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Entitlements = {
  pro: boolean;
  proUntil: string | null;
  maxActiveInspections: number | null;
  freeDefectLimit: number | null;
  activeInspections: number;
};

export type Plan = {
  id: "free" | "pro_annual" | "report";
  name_en: string;
  name_ar: string;
  billing: "free" | "annual" | "one_time";
  price_cents: number;
  currency: string;
  max_active_inspections: number | null;
  max_defects_per_inspection: number | null;
};

/** What the signed-in user can do. Enforcement lives in database triggers; this is for the UI. */
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_entitlements");
  const e = (data ?? {}) as Record<string, unknown>;
  return {
    pro: e.pro === true,
    proUntil: (e.pro_until as string | null) ?? null,
    maxActiveInspections: (e.max_active_inspections as number | null) ?? null,
    freeDefectLimit: (e.max_defects_per_inspection as number | null) ?? null,
    activeInspections: Number(e.active_inspections ?? 0),
  };
});

export const isInspectionUnlocked = cache(async (inspectionId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("inspection_unlocked", { p_inspection: inspectionId });
  return data === true;
});

export const getPlans = cache(async (): Promise<Plan[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []) as Plan[];
});

export function formatPrice(cents: number, currency: string, lang: "en" | "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
