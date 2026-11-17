// Accept a pasted endpoint such as ".../rest/v1/" and keep only the project origin.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/(rest|auth|storage)\/v1\/?$/, "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_URL.includes("YOUR-PROJECT-REF");
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
