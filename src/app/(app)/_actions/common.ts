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

export function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ActionError) return { ok: false, error: error.message };
  console.error("[action]", error);
  return { ok: false, error: "generic" };
}
