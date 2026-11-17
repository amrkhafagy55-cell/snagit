import "server-only";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Which external sign-in providers are switched on in the Supabase project.
 * Read from GoTrue's public settings endpoint and cached for 5 minutes, so the UI
 * never shows a sign-in button that would end on a "provider is not enabled" error.
 */
export async function getEnabledProviders(): Promise<{ google: boolean }> {
  if (!isSupabaseConfigured()) return { google: false };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { google: false };
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return { google: settings.external?.google === true };
  } catch {
    return { google: false };
  }
}
