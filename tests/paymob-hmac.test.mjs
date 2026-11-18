// Unit tests for the Paymob webhook signature check. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { paymobHmac, paymobHmacString, verifyPaymobHmac } from "../src/lib/payments/paymob-hmac.ts";

const SECRET = "test_hmac_secret_123";
const obj = {
  id: 192036465,
  pending: false,
  amount_cents: 39900,
  success: true,
  is_auth: false,
  is_capture: false,
  is_standalone_payment: true,
  is_voided: false,
  is_refunded: false,
  is_3d_secure: true,
  integration_id: 4567890,
  has_parent_transaction: false,
  order: { id: 217503754, merchant_order_id: "6a6f1a7e-0000-4000-8000-000000000001" },
  created_at: "2026-11-18T10:24:33.611651",
  currency: "EGP",
  error_occured: false,
  owner: 302852,
  source_data: { type: "card", pan: "2346", sub_type: "MasterCard" },
};

test("concatenates the 20 documented fields in order, booleans lowercase, no separators", () => {
  assert.equal(
    paymobHmacString(obj),
    "39900" + "2026-11-18T10:24:33.611651" + "EGP" + "false" + "false" + "192036465" + "4567890" +
      "true" + "false" + "false" + "false" + "true" + "false" + "217503754" + "302852" + "false" +
      "2346" + "MasterCard" + "card" + "true",
  );
});

test("HMAC is SHA-512 hex of that string", () => {
  const expected = createHmac("sha512", SECRET).update(paymobHmacString(obj)).digest("hex");
  assert.equal(paymobHmac(obj, SECRET), expected);
  assert.equal(expected.length, 128);
});

test("accepts a genuine signature (case-insensitive)", () => {
  assert.equal(verifyPaymobHmac(obj, paymobHmac(obj, SECRET), SECRET), true);
  assert.equal(verifyPaymobHmac(obj, paymobHmac(obj, SECRET).toUpperCase(), SECRET), true);
});

test("rejects tampering, wrong secret, missing or malformed signatures", () => {
  const sig = paymobHmac(obj, SECRET);
  assert.equal(verifyPaymobHmac({ ...obj, amount_cents: 1 }, sig, SECRET), false);
  assert.equal(verifyPaymobHmac({ ...obj, success: false }, sig, SECRET), false);
  assert.equal(verifyPaymobHmac({ ...obj, order: { ...obj.order, id: 1 } }, sig, SECRET), false);
  assert.equal(verifyPaymobHmac(obj, sig, "other_secret"), false);
  assert.equal(verifyPaymobHmac(obj, "", SECRET), false);
  assert.equal(verifyPaymobHmac(obj, null, SECRET), false);
  assert.equal(verifyPaymobHmac(obj, "zz" + sig.slice(2), SECRET), false);
  assert.equal(verifyPaymobHmac(obj, sig.slice(0, 64), SECRET), false);
  assert.equal(verifyPaymobHmac(obj, sig, ""), false);
});
