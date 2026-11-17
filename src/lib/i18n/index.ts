import ar from "./ar";
import en, { type Dictionary } from "./en";
import type { ChecklistItem, Lang, Room } from "@/lib/types";

export type { Dictionary };
export const LANG_COOKIE = "snagit_lang";
export const DEFAULT_LANG: Lang = "en";

export function getDictionary(lang: Lang): Dictionary {
  return lang === "ar" ? ar : en;
}

export function normalizeLang(value: string | undefined | null): Lang {
  return value === "ar" || value === "en" ? value : DEFAULT_LANG;
}

const NUMBERED_ROOMS = new Set(["bedroom", "bathroom", "balcony"]);

export function roomLabel(room: Pick<Room, "room_type" | "type_index" | "name">, t: Dictionary): string {
  if (room.name) return room.name;
  const base = t.rooms[room.room_type];
  return NUMBERED_ROOMS.has(room.room_type) || room.type_index > 1 ? `${base} ${room.type_index}` : base;
}

export function categoryLabel(category: string, t: Dictionary): string {
  return (t.categories as Record<string, string>)[category] ?? category;
}

export function itemTitle(item: Pick<ChecklistItem, "title_en" | "title_ar">, lang: Lang): string {
  return lang === "ar" ? item.title_ar || item.title_en : item.title_en || item.title_ar;
}

// Arabic UI keeps Latin digits so dates and counts match unit numbers, D-numbers and user data.
const LOCALE: Record<Lang, string> = { ar: "ar-EG-u-nu-latn", en: "en-GB" };
export const APP_TIME_ZONE = "Africa/Cairo";

export function formatDate(value: string | null | undefined, lang: Lang): string {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(value + "T12:00:00Z") : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : APP_TIME_ZONE,
  }).format(date);
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang]).format(value);
}

/** Today's calendar date (YYYY-MM-DD) in Cairo, regardless of the server's time zone. */
export function todayIso(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(d);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
