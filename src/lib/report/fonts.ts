import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Fonts are embedded as data URIs so the PDF renders identically on any server (no system fonts needed).
const FACES: { family: string; file: string; weight: number; range?: string }[] = [
  ...[400, 600, 700].map((w) => ({ family: "SnagitLatin", file: `@fontsource/inter/files/inter-latin-${w}-normal.woff2`, weight: w })),
  ...[400, 600, 700].map((w) => ({
    family: "SnagitArabic",
    file: `@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-${w}-normal.woff2`,
    weight: w,
    range: "U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FEFF",
  })),
  ...[400, 600, 700].map((w) => ({
    family: "SnagitArabic",
    file: `@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-${w}-normal.woff2`,
    weight: w,
  })),
];

let cached: string | null = null;

export async function fontFaceCss(): Promise<string> {
  if (cached) return cached;
  const root = path.join(process.cwd(), "node_modules");
  const rules = await Promise.all(
    FACES.map(async (f) => {
      const data = (await readFile(path.join(root, f.file))).toString("base64");
      return `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");${f.range ? `unicode-range:${f.range};` : ""}}`;
    }),
  );
  cached = rules.join("\n");
  return cached;
}
