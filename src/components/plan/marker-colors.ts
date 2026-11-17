import type { Severity } from "@/lib/types";

// Shared by server and client components (must not live in a "use client" module).
// Spec colours: red critical, orange high, yellow medium, blue low.
export const MARKER_COLORS: Record<Severity, string> = {
  critical: "bg-sev-critical text-white",
  high: "bg-sev-high text-white",
  medium: "bg-sev-medium text-navy-950",
  low: "bg-sev-low text-white",
};
