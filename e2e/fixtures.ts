import { test as base, expect, type Page } from "@playwright/test";

/** Every test starts in English unless it switches language itself. */
export const test = base.extend<{ lang: "en" | "ar" }>({
  lang: ["en", { option: true }],
  context: async ({ context, baseURL, lang }, provide) => {
    await context.addCookies([{ name: "snagit_lang", value: lang, url: baseURL! }]);
    await provide(context);
  },
});
export { expect };

export const hasCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

/** Signs in with the dedicated E2E account from .env.local (never a real user's account). */
export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}
