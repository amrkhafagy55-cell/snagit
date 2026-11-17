import "server-only";
import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";

const LOCAL_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

export class PdfEngineUnavailable extends Error {}

/**
 * Headless Chromium for PDF rendering. Serverless hosts use @sparticuz/chromium; anywhere else
 * uses an installed Chrome/Edge (or CHROME_EXECUTABLE_PATH), so no extra download is needed.
 */
export async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const executablePath = LOCAL_CANDIDATES.find((p): p is string => Boolean(p) && existsSync(p!));
  if (!executablePath) throw new PdfEngineUnavailable("No Chrome/Edge found. Set CHROME_EXECUTABLE_PATH.");
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-extensions", "--font-render-hinting=none"],
  });
}
