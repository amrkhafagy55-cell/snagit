import { test, expect } from "./fixtures";

test.describe("public pages", () => {
  test("landing shows pricing and legal links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#pricing")).toContainText("EGP");
    for (const name of ["Privacy policy", "Terms of use", "Refund policy", "Contact us"]) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }
  });

  test("language toggle switches to Arabic, right-to-left", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "العربية" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("legal pages render in both languages", async ({ page, context, baseURL }) => {
    for (const [path, en, ar] of [
      ["/privacy", "Privacy policy", "سياسة الخصوصية"],
      ["/terms", "Terms of use", "شروط الاستخدام"],
      ["/refund", "Refund policy", "سياسة الاسترداد"],
      ["/contact", "Contact us", "تواصل معنا"],
    ] as const) {
      await context.addCookies([{ name: "snagit_lang", value: "en", url: baseURL! }]);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(en);
      await context.addCookies([{ name: "snagit_lang", value: "ar", url: baseURL! }]);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(ar);
    }
  });

  test("signed-out visitors are sent to sign in, including from admin", async ({ page }) => {
    for (const path of ["/dashboard", "/admin", "/admin/users", "/billing"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  });

  test("an unknown share link shows the expired message, never a file", async ({ page, request }) => {
    const token = "0".repeat(64);
    await page.goto(`/s/${token}`);
    await expect(page.getByRole("heading", { name: "This link has expired or was revoked" })).toBeVisible();
    const res = await request.get(`/s/${token}/download`, { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers()["location"]).toContain(`/s/${token}`);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    const share = await request.get(`/s/${"0".repeat(64)}`);
    expect(share.headers()["referrer-policy"]).toBe("no-referrer");
  });

  test("auth callback refuses off-site redirects", async ({ request }) => {
    const res = await request.get("/auth/callback?next=/%09/evil.example", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(new URL(res.headers()["location"]!, "http://x").host).not.toContain("evil.example");
  });
});
