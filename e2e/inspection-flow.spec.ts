import { test, expect, hasCredentials, signIn } from "./fixtures";
import type { Page } from "@playwright/test";

// The full journey on a dedicated test account (E2E_EMAIL / E2E_PASSWORD in .env.local):
// create an inspection → register a defect → generate a report → share it → revoke → delete.
// It cleans up after itself and removes leftovers named "E2E …" from earlier runs.
test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD in .env.local to run the signed-in flow");

async function deleteLeftovers(page: Page) {
  for (let i = 0; i < 5; i++) {
    await page.goto("/dashboard");
    const card = page.getByRole("link").filter({ hasText: /^E2E \d+/ }).first();
    if (!(await card.isVisible().catch(() => false))) return;
    await card.click();
    await page.waitForURL(/\/inspections\/[0-9a-f-]{36}$/);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete inspection" }).click();
    await page.waitForURL(/\/dashboard/);
  }
}

test("inspection → defect → report → share link → revoke → delete", async ({ page, browser, baseURL }) => {
  const project = `E2E ${Date.now()}`;
  await signIn(page);
  await deleteLeftovers(page);

  // 1. New inspection through the wizard (defaults for unit, date and plan).
  await page.goto("/properties/new");
  await page.getByLabel("Project / compound name").fill(project);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create inspection" }).click();
  await page.waitForURL(/\/inspections\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const inspectionUrl = page.url();
  await expect(page.getByRole("heading", { name: project })).toBeVisible();

  // 2. Register a defect.
  await page.goto(`${inspectionUrl}/defects/new`);
  await page.getByLabel("Defect title").fill("E2E hairline crack above door");
  await page.getByRole("button", { name: "Save defect" }).click();
  await page.waitForURL(/\/defects\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.goto(`${inspectionUrl}/defects`);
  await expect(page.getByText("E2E hairline crack above door")).toBeVisible();

  // 3. Generate a PDF report (headless Chromium on the server).
  await page.goto(`${inspectionUrl}/report`);
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText("Report ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/^Version 1/).first()).toBeVisible();

  // 4. Share link (only when the server has the service-role key).
  const share = page.getByRole("button", { name: "Share", exact: true }).first();
  if (await share.isVisible()) {
    await share.click();
    await page.getByRole("button", { name: "Create link" }).click();
    const linkBox = page.getByRole("textbox", { name: "Share links" });
    await expect(linkBox).toHaveValue(/\/s\/[0-9a-f]{64}$/);
    const link = await linkBox.inputValue();
    const sharePath = new URL(link).pathname;

    const visitor = await browser.newContext({ baseURL });
    const anon = await visitor.newPage();
    await anon.goto(sharePath);
    await expect(anon.getByText(project)).toBeVisible();
    const dl = await anon.request.get(`${sharePath}/download`, { maxRedirects: 0 });
    expect(dl.status()).toBe(302);
    expect(dl.headers()["location"]).toContain("/storage/v1/object/sign/reports/");

    await page.reload();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByText("No active share links.")).toBeVisible();

    await anon.reload();
    await expect(anon.getByRole("heading", { name: "This link has expired or was revoked" })).toBeVisible();
    await visitor.close();
  } else {
    test.info().annotations.push({ type: "note", description: "Share links skipped: SUPABASE_SERVICE_ROLE_KEY not set" });
  }

  // 5. Clean up.
  await page.goto(inspectionUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete inspection" }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(project)).toHaveCount(0);
});

test("non-admins get the not-found page on the admin area", async ({ page }) => {
  await signIn(page);
  // The E2E account must not be an admin; if it is, this test tells you. (The HTTP status is 200
  // because the app shell streams before the admin layout runs; no admin content is sent.)
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByText("Plans & billing")).toHaveCount(0);
});
