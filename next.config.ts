import type { NextConfig } from "next";

// Cache Components is intentionally off: almost every SNAGIT page is per-user and
// reads the auth cookie, so classic dynamic rendering is simpler and correct.
// Revisit before the next Next.js major, where it becomes the default (see docs/decisions.md).
const nextConfig: NextConfig = {
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
