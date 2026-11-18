import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client. Bypasses RLS — use ONLY in server code that has already verified the
 * caller (checkout after auth) or the request (Paymob webhook after HMAC). Never import in
 * client components; the key must never be prefixed NEXT_PUBLIC_.
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

export function isAdminClientConfigured() {
  return SERVICE_KEY.length > 20;
}

export function createAdminClient() {
  if (!isAdminClientConfigured()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
