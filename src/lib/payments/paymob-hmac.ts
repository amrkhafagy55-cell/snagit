import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paymob "Transaction Processed Callback" HMAC (POST webhook).
 * Source: developers.paymob.com → Webhook callbacks and HMAC → HMAC Transaction Callback.
 * Values of these fields, in this exact order, are concatenated with no separator,
 * booleans as lowercase true/false, then HMAC-SHA512 with the account's HMAC secret (hex).
 * Kept free of app imports so it can be unit-tested directly with node --test.
 */
export const PAYMOB_HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function paymobHmacString(obj: unknown): string {
  return PAYMOB_HMAC_FIELDS.map((f) => {
    const v = pick(obj, f);
    return v === null || v === undefined ? "" : String(v);
  }).join("");
}

export function paymobHmac(obj: unknown, secret: string): string {
  return createHmac("sha512", secret).update(paymobHmacString(obj), "utf8").digest("hex");
}

/** Constant-time comparison of the received ?hmac= value with our own calculation. */
export function verifyPaymobHmac(obj: unknown, received: string | null | undefined, secret: string): boolean {
  if (!received || !secret || !/^[0-9a-f]{128}$/i.test(received)) return false;
  const expected = Buffer.from(paymobHmac(obj, secret), "hex");
  const got = Buffer.from(received.toLowerCase(), "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}
