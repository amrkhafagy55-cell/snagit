import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const SETTING_KEYS = ["announcement_en", "announcement_ar", "support_email", "support_whatsapp", "ai_daily_limit"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export type AppSettings = Record<SettingKey, string>;

const EMPTY: AppSettings = { announcement_en: "", announcement_ar: "", support_email: "", support_whatsapp: "", ai_daily_limit: "" };

/** Public app settings edited in Admin → Settings (migration 0007). Empty values until the table exists. */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");
  const out = { ...EMPTY };
  if (error || !data) return out;
  for (const row of data as { key: string; value: string | null }[]) {
    if ((SETTING_KEYS as readonly string[]).includes(row.key)) out[row.key as SettingKey] = row.value ?? "";
  }
  return out;
});
