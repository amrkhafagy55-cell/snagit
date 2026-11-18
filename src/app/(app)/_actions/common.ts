import "server-only";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export class ActionError extends Error {}

/** Every server action starts here: a verified user plus an RLS-scoped client. */
export async function authed() {
  const user = await getUser();
  if (!user) throw new ActionError("unauthorized");
  const supabase = await createClient();
  return { user, supabase };
}

const LIMIT_CODES = ["active_inspections", "defects", "plan", "after_photos"] as const;

/** Plan limits are raised by database triggers as "SNAGIT_LIMIT:<code>". */
export function limitCode(error: unknown): string | null {
  const msg = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  const m = /SNAGIT_LIMIT:(\w+)/.exec(msg);
  return m && (LIMIT_CODES as readonly string[]).includes(m[1]) ? `limit_${m[1]}` : null;
}

export function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ActionError) return { ok: false, error: error.message };
  const limit = limitCode(error);
  if (limit) return { ok: false, error: limit };
  console.error("[action]", error);
  return { ok: false, error: "generic" };
}
