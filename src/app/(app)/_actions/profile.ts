"use server";
import { revalidatePath } from "next/cache";
import { fieldErrors, profileSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { authed, fail } from "./common";

export async function updateProfileAction(input: {
  fullName: string;
  phone: string;
  company: string;
  accountType: string;
}): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
  try {
    const { user, supabase } = await authed();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
        company: parsed.data.company || null,
      })
      .eq("id", user.id);
    if (error) throw error;
    const { error: roleErr } = await supabase.rpc("set_account_type", { p_type: parsed.data.accountType });
    if (roleErr) throw roleErr;
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
