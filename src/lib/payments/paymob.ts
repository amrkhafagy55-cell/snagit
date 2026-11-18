import "server-only";
import { isAdminClientConfigured } from "@/lib/supabase/admin";

/**
 * Paymob (Egypt) via the Intention API + Unified Checkout.
 * Docs: developers.paymob.com → Intention APIs → Create Intention; Unified Checkout redirection.
 * Test vs live is decided by which keys/integration IDs are configured: Paymob test keys and
 * test integration IDs never move real money. Nothing here marks a payment as paid; only the
 * HMAC-verified webhook does.
 */
const cfg = () => ({
  base: (process.env.PAYMOB_API_BASE ?? "https://accept.paymob.com").replace(/\/$/, ""),
  secretKey: process.env.PAYMOB_SECRET_KEY ?? "",
  publicKey: process.env.PAYMOB_PUBLIC_KEY ?? "",
  hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? "",
  integrationIds: (process.env.PAYMOB_INTEGRATION_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0),
});

/** Payments are offered only when Paymob and the server-side Supabase key are both configured. */
export function isPaymentsEnabled(): boolean {
  const c = cfg();
  return Boolean(c.secretKey && c.publicKey && c.hmacSecret && c.integrationIds.length) && isAdminClientConfigured();
}

/** Keys starting with "egy_sk_test" / "egy_pk_test" are Paymob test-mode keys. */
export function isPaymobTestMode(): boolean {
  return /_test_/.test(cfg().secretKey) || /_test_/.test(cfg().publicKey);
}

export function paymobHmacSecret(): string {
  return cfg().hmacSecret;
}

export type IntentionInput = {
  amountCents: number;
  currency: string;
  itemName: string;
  itemDescription: string;
  specialReference: string; // our payments.id — returned as order.merchant_order_id in callbacks
  billing: { firstName: string; lastName: string; email: string; phone: string };
  notificationUrl: string;
  redirectionUrl: string;
};

export class PaymobError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export async function createIntention(input: IntentionInput) {
  const c = cfg();
  const res = await fetch(`${c.base}/v1/intention/`, {
    method: "POST",
    headers: { Authorization: `Token ${c.secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: input.currency,
      payment_methods: c.integrationIds,
      items: [{ name: input.itemName, amount: input.amountCents, description: input.itemDescription, quantity: 1 }],
      billing_data: {
        first_name: input.billing.firstName,
        last_name: input.billing.lastName,
        email: input.billing.email,
        phone_number: input.billing.phone,
        // Paymob requires these keys; digital goods have no shipping address.
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        city: "NA",
        state: "NA",
        country: "EG",
        postal_code: "NA",
      },
      special_reference: input.specialReference,
      extras: { payment_id: input.specialReference },
      notification_url: input.notificationUrl,
      redirection_url: input.redirectionUrl,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as
    | { id?: string; client_secret?: string; intention_order_id?: number; detail?: unknown }
    | null;
  if (!res.ok || !body?.client_secret) {
    throw new PaymobError(`intention failed: ${res.status} ${JSON.stringify(body?.detail ?? body ?? "").slice(0, 300)}`, res.status);
  }
  return { intentionId: String(body.id ?? ""), orderId: body.intention_order_id ? String(body.intention_order_id) : null, clientSecret: body.client_secret };
}

export function checkoutUrl(clientSecret: string): string {
  const c = cfg();
  const q = new URLSearchParams({ publicKey: c.publicKey, clientSecret });
  return `${c.base}/unifiedcheckout/?${q.toString()}`;
}
