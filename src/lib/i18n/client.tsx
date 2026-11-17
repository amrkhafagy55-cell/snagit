"use client";
import { createContext, useContext, type ReactNode } from "react";
import { getDictionary, type Dictionary } from "./index";
import type { Lang } from "@/lib/types";

const I18nContext = createContext<{ lang: Lang; t: Dictionary } | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <I18nContext value={{ lang, t: getDictionary(lang) }}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Translate an error code returned by a server action. */
export function useErrorText() {
  const { t } = useI18n();
  return (code: string | undefined | null) =>
    code ? ((t.errors as Record<string, string>)[code] ?? t.errors.generic) : "";
}
