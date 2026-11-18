/**
 * Returns `value` when it is a same-site path ("/dashboard?x=1"), else `fallback`.
 * Browsers turn "//host", "/\host" and paths with tabs/newlines ("/\t/host") into other sites,
 * so we reject those and then check the resolved origin as a final guard.
 */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Backslashes and any control or whitespace characters can be normalised away by URL parsers.
  if (/[\\\u0000-\u001f\u007f\s]/.test(value)) return fallback;
  try {
    const base = "https://snagit.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
