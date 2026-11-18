// Accept a pasted endpoint such as ".../rest/v1/" and keep only the project origin.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/(rest|auth|storage)\/v1\/?$/, "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_URL.includes("YOUR-PROJECT-REF");
}

// Server-only callers (auth e-mails, payment redirects). On Vercel, fall back to the
// production domain so a missing NEXT_PUBLIC_SITE_URL never sends users to localhost.
export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.trim().replace(/\/+$/, "");
}
