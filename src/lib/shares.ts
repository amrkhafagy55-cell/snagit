import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { isAdminClientConfigured } from "@/lib/supabase/admin";

export type ShareLink = { id: string; url: string; report_id: string; expires_at: string; view_count: number; created_at: string };

/** Share links work only when the server can sign download URLs (SUPABASE_SERVICE_ROLE_KEY). */
export function isSharingEnabled() {
  return isAdminClientConfigured();
}

/** Live (not revoked, not expired) share links of one inspection, newest first. RLS: owner only. */
export async function getActiveShares(inspectionId: string): Promise<ShareLink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_shares")
    .select("id, token, report_id, expires_at, view_count, created_at")
    .eq("inspection_id", inspectionId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const base = siteUrl();
  return data.map(({ token, ...s }) => ({ ...s, url: `${base}/s/${token}` }));
}
