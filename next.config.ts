import type { NextConfig } from "next";

// Cache Components is intentionally off: almost every SNAGIT page is per-user and
// reads the auth cookie, so classic dynamic rendering is simpler and correct.
// Revisit before the next Next.js major, where it becomes the default (see docs/decisions.md).
const nextConfig: NextConfig = {
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
