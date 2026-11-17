"use server";
import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function setLanguage(value: string) {
  const lang = normalizeLang(value);
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  if (isSupabaseConfigured()) {
    const user = await getUser();
    if (user) {
      const supabase = await createClient();
      await supabase.from("profiles").update({ locale: lang }).eq("id", user.id);
    }
  }
}
