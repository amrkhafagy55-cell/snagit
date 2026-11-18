import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()).origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

// Content Security Policy (D-013). Next.js inlines bootstrap scripts, so script-src needs
// 'unsafe-inline' unless we move to per-request nonces. Everything else is locked to this site
// and the Supabase project. pdf.js runs in a same-origin worker and may compile WebAssembly.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Google sign-in posts to a server action that redirects to Supabase, then Google.
  `form-action 'self' ${supabaseOrigin} https://accounts.google.com`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .join("; ")
  .replace(/\s+;/g, ";");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Cache Components is intentionally off: almost every SNAGIT page is per-user and
// reads the auth cookie, so classic dynamic rendering is simpler and correct.
// Revisit before the next Next.js major, where it becomes the default (see docs/decisions.md).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Share links carry a secret token in the URL: never leak it in a Referer header.
      { source: "/s/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  // PDF reports run headless Chromium on the server; never bundle these.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // The report embeds these fonts; make sure they ship with the server function.
  outputFileTracingIncludes: {
    "/inspections/**": [
      "./node_modules/@fontsource/inter/files/inter-latin-{400,600,700}-normal.woff2",
      "./node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-{arabic,latin}-{400,600,700}-normal.woff2",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  // Server actions carry up to 3 resized photos (~1280 px JPEG) to the AI assistant.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
