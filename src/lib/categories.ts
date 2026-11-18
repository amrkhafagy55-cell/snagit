import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { STANDARD_CATEGORIES, type Lang } from "@/lib/types";

export type DefectCategory = { key: string; name_en: string; name_ar: string; sort_order: number; is_active: boolean };

/** Admin-managed defect categories (migration 0007), hidden ones included. Falls back to the four built-in ones. */
export const getDefectCategories = cache(async (): Promise<DefectCategory[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("defect_categories")
    .select("key, name_en, name_ar, sort_order, is_active")
    .order("sort_order")
    .order("key");
  if (!error && data?.length) return data as DefectCategory[];
  const en = getDictionary("en").categories;
  const ar = getDictionary("ar").categories;
  return STANDARD_CATEGORIES.map((key, i) => ({ key, name_en: en[key], name_ar: ar[key], sort_order: (i + 1) * 10, is_active: true }));
});

/** key → name in one language, for every category (hidden ones too, so old defects keep their label). */
export async function getCategoryLabels(lang: Lang): Promise<Record<string, string>> {
  const cats = await getDefectCategories();
  return Object.fromEntries(cats.map((c) => [c.key, lang === "ar" ? c.name_ar : c.name_en]));
}

/** Keys offered when choosing a category: active ones, in admin order. */
export async function getActiveCategoryKeys(): Promise<string[]> {
  return (await getDefectCategories()).filter((c) => c.is_active).map((c) => c.key);
}
