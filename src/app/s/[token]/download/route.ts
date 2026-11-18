import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const TOKEN = /^[0-9a-f]{64}$/;

function slug(s: string) {
  return s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "inspection";
}

/**
 * Public download for a share link. The token is checked by open_report_share() (anon, security
 * definer: only live, unrevoked links resolve and each call counts a download). Only then does the
 * server sign a 60-second URL for that one private file with the service-role key.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/s/[token]/download">) {
  const { token } = await params;
  const notFound = () => NextResponse.redirect(new URL(`/s/${TOKEN.test(token) ? token : "invalid"}`, request.url), { status: 303 });
  if (!TOKEN.test(token) || !isSupabaseConfigured() || !isAdminClientConfigured()) return notFound();

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.rpc("open_report_share", { p_token: token });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row?.storage_path) return notFound();

  const fileName = `SNAGIT-${slug(row.project_name)}-v${row.version}-${row.language}.pdf`;
  const { data: signed, error: signErr } = await createAdminClient()
    .storage.from("reports")
    .createSignedUrl(row.storage_path, 60, { download: fileName });
  if (signErr || !signed?.signedUrl) {
    console.error("[share] sign failed", signErr?.message);
    return notFound();
  }
  const res = NextResponse.redirect(signed.signedUrl, { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
