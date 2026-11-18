"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/supabase/env";
import type { ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

const createInput = z.object({ reportId: z.uuid(), days: z.union([z.literal(7), z.literal(30), z.literal(90)]) });

/** Creates a revocable public link to one report version. RLS checks the report is the caller's. */
export async function createShareAction(reportId: string, days: number): Promise<ActionResult<{ url: string }>> {
  const parsed = createInput.safeParse({ reportId, days });
  if (!parsed.success) return { ok: false, error: "invalid" };
  // The public download needs the server key to sign a URL for a private file; don't hand out dead links.
  if (!isAdminClientConfigured()) return { ok: false, error: "shareUnavailable" };
  try {
    const { supabase } = await authed();
    const { data: report } = await supabase
      .from("reports")
      .select("id, inspection_id")
      .eq("id", parsed.data.reportId)
      .maybeSingle();
    if (!report) throw new ActionError("notFound");
    const { data, error } = await supabase
      .from("report_shares")
      .insert({
        report_id: report.id,
        inspection_id: report.inspection_id,
        expires_at: new Date(Date.now() + parsed.data.days * 86_400_000).toISOString(),
      })
      .select("token")
      .single();
    if (error) throw error;
    revalidatePath(`/inspections/${report.inspection_id}/report`);
    return { ok: true, data: { url: `${siteUrl()}/s/${data.token}` } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeShareAction(shareId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(shareId).success) return { ok: false, error: "invalid" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("report_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId)
      .select("inspection_id");
    if (error) throw error;
    if (!data?.length) throw new ActionError("notFound");
    revalidatePath(`/inspections/${data[0].inspection_id}/report`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
