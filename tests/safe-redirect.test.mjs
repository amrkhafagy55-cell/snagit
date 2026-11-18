// Open-redirect guard used by sign-in and the auth callback. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "../src/lib/safe-redirect.ts";

test("keeps same-site paths with query and hash", () => {
  assert.equal(safeRedirectPath("/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("/inspections/abc/report?x=1#v2"), "/inspections/abc/report?x=1#v2");
  assert.equal(safeRedirectPath("/reset-password"), "/reset-password");
});

test("rejects anything that can leave the site", () => {
  for (const bad of [
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/ /evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "\\\\evil.com",
    "/%2F%2Fevil.com".replace("%2F%2F", "\\/"),
    null,
    undefined,
    42,
  ]) {
    assert.equal(safeRedirectPath(bad), "/dashboard", JSON.stringify(bad));
  }
});

test("uses the given fallback", () => {
  assert.equal(safeRedirectPath("//evil.com", "/login"), "/login");
});
