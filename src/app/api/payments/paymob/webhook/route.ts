import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaymentsEnabled, paymobHmacSecret } from "@/lib/payments/paymob";
import { verifyPaymobHmac } from "@/lib/payments/paymob-hmac";
import { applyTransaction, type PaymobTxn } from "@/lib/payments/fulfil";

/**
 * Paymob "Transaction Processed Callback" (server-to-server POST).
 * The only place a payment can become "paid": the HMAC must verify, and the amount must match.
 */
export async function POST(request: NextRequest) {
  if (!isPaymentsEnabled()) return NextResponse.json({ ok: false }, { status: 503 });

  const hmac = request.nextUrl.searchParams.get("hmac");
  let body: { type?: string; obj?: PaymobTxn } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const txn = body?.obj;
  if (!txn || body?.type !== "TRANSACTION") {
    // Other callback types (e.g. TOKEN) aren't used by SNAGIT; acknowledge so Paymob stops retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!verifyPaymobHmac(txn, hmac, paymobHmacSecret())) {
    console.warn("[paymob] webhook rejected: bad HMAC", { txn: txn.id });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await applyTransaction(createAdminClient(), txn);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[paymob] webhook failed", e);
    // 500 lets Paymob retry later; applyTransaction is idempotent.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
