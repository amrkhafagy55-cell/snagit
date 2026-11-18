import { randomBytes } from "node:crypto";
import { test, expect } from "./fixtures";

// Creates a throwaway confirmed account with the admin API, gives it real data and a stored PDF,
// deletes it from Settings, then checks with the admin API that the user and its files are gone.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/(rest|auth|storage)\/v1\/?$/, "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

test.skip(SERVICE_KEY.length < 20 || !SUPABASE_URL, "Needs SUPABASE_SERVICE_ROLE_KEY in .env.local");

test("a user deletes their own account and nothing of theirs is left", async ({ page }) => {
  const email = `snagit-e2e-delete-${Date.now()}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Delete Me", locale: "en" } }),
  });
  expect(created.ok, `admin create user: HTTP ${created.status}`).toBe(true);
  const userId = (await created.json()).id as string;

  try {
    // Sign in and create real data: the sample project, then a PDF report in Storage.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/dashboard/);
    await page.getByRole("button", { name: "Load sample project" }).click();
    await page.waitForURL(/\/inspections\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await page.goto(`${page.url()}/report`);
    await page.getByRole("button", { name: "Generate report" }).click();
    await expect(page.getByText("Report ready")).toBeVisible({ timeout: 90_000 });

    const listReports = async () => {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/reports`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ prefix: `${userId}/`, limit: 100 }),
      });
      return (await r.json()) as unknown[];
    };
    expect((await listReports()).length).toBeGreaterThan(0);

    // Delete from Settings: the button stays disabled until the e-mail matches.
    await page.goto("/settings");
    const button = page.getByRole("button", { name: "Delete my account permanently" });
    await page.getByLabel("Type your e-mail to confirm").fill("someone-else@example.com");
    await expect(button).toBeDisabled();
    await page.getByLabel("Type your e-mail to confirm").fill(email);
    page.once("dialog", (d) => d.accept());
    await button.click();
    await page.waitForURL(/\/\?account=deleted$/, { timeout: 60_000 });
    await expect(page.getByText("Your account and its data were deleted.")).toBeVisible();

    // Gone: the auth user, its files, and the session.
    const gone = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: admin });
    expect(gone.status).toBe(404);
    expect(await listReports()).toEqual([]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    // If anything failed half-way, don't leave the throwaway account behind (profile first, as the app does).
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, { method: "DELETE", headers: admin }).catch(() => undefined);
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: admin }).catch(() => undefined);
  }
});
