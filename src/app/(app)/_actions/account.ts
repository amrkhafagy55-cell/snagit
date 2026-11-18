"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

const BUCKETS = ["defect-photos", "floor-plans", "reports"] as const;

/** Every object under `<prefix>/`, following sub-folders (paths are at most 4 levels deep). */
async function listAll(supabase: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id === null) out.push(...(await listAll(supabase, bucket, path, depth + 1)));
      else out.push(path);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Permanently deletes the signed-in user's account:
 * 1. their files in every bucket (with their own session: storage policies limit it to `<uid>/…`),
 * 2. their profile (service role), which cascades to every row they own (payments stay for
 *    accounting, anonymised by migration 0008), then the auth user (admin API).
 * Admins can't delete themselves (avoids locking the project out of its admin panel).
 */
export async function deleteAccountAction(confirmEmail: string): Promise<ActionResult> {
  if (!isAdminClientConfigured()) return { ok: false, error: "accountDeleteUnavailable" };
  try {
    const { user, supabase } = await authed();
    const typed = z.string().trim().toLowerCase().max(320).parse(confirmEmail ?? "");
    if (!user.email || typed !== user.email.toLowerCase()) throw new ActionError("confirmMismatch");
    const profile = await getProfile();
    if (profile?.role === "admin") throw new ActionError("adminCannotDelete");

    // 1. Files: what the database knows about, plus anything left in the user's folders.
    const [photos, reports, props] = await Promise.all([
      supabase.from("defect_photos").select("storage_path"),
      supabase.from("reports").select("storage_path"),
      supabase.from("properties").select("floor_plan_path, floor_plan_image_path"),
    ]);
    for (const r of [photos, reports, props]) if (r.error) throw r.error;
    const known: Record<(typeof BUCKETS)[number], string[]> = {
      "defect-photos": (photos.data ?? []).map((p) => p.storage_path as string),
      reports: (reports.data ?? []).map((r) => r.storage_path as string),
      "floor-plans": (props.data ?? []).flatMap((p) => [p.floor_plan_path, p.floor_plan_image_path].filter(Boolean) as string[]),
    };
    for (const bucket of BUCKETS) {
      const paths = [...new Set([...known[bucket], ...(await listAll(supabase, bucket, user.id))])].filter((p) =>
        p.startsWith(`${user.id}/`),
      );
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
    }

    // 2. Data, then the account. Deleting the auth user straight away fails on Supabase ("Database
    //    error deleting user"): Auth runs the cascade as supabase_auth_admin, which has no rights on our
    //    tables and triggers. So the profile goes first as service_role (cascading every row the user
    //    owns; payments are anonymised by migration 0008), then the now-empty auth user.
    const admin = createAdminClient();
    const { error: profileErr } = await admin.from("profiles").delete().eq("id", user.id);
    if (profileErr) throw profileErr;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    // 3. Drop the session cookies (the user no longer exists, so a server error here is expected).
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "confirmMismatch" };
    return fail(e);
  }
  redirect("/?account=deleted");
}
