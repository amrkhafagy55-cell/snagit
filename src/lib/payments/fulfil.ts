import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type PaymentRow = {
  id: string;
  user_id: string;
  kind: "pro_annual" | "report";
  inspection_id: string | null;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "failed";
};

export type PaymobTxn = {
  id?: number | string;
  success?: boolean;
  pending?: boolean;
  is_voided?: boolean;
  is_refunded?: boolean;
  error_occured?: boolean;
  amount_cents?: number;
  currency?: string;
  order?: { id?: number | string; merchant_order_id?: string | null };
  payment_key_claims?: { extra?: { payment_id?: string } };
  data?: { message?: string };
};

/** Our payment id, sent as special_reference (→ order.merchant_order_id) and in extras. */
export function paymentIdFromTxn(txn: PaymobTxn): string | null {
  const id = txn.order?.merchant_order_id ?? txn.payment_key_claims?.extra?.payment_id ?? null;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * Applies a verified Paymob transaction to our records. Idempotent: Paymob may retry callbacks.
 * Runs with the service-role client (the webhook has no user session).
 */
export async function applyTransaction(admin: SupabaseClient, txn: PaymobTxn): Promise<"paid" | "failed" | "ignored"> {
  const paymentId = paymentIdFromTxn(txn);
  if (!paymentId) return "ignored";
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, kind, inspection_id, amount_cents, currency, status")
    .eq("id", paymentId)
    .maybeSingle<PaymentRow>();
  if (!payment) return "ignored";

  const settled = txn.pending === false;
  const succeeded =
    txn.success === true && settled && !txn.is_voided && !txn.is_refunded && !txn.error_occured;
  // Never trust the amount from the client side of the flow: it must match what we asked for.
  const amountOk = Number(txn.amount_cents) === payment.amount_cents && (!txn.currency || txn.currency === payment.currency);
  const txnId = txn.id != null ? String(txn.id) : null;
  const callback = {
    id: txnId,
    success: txn.success,
    pending: txn.pending,
    amount_cents: txn.amount_cents,
    currency: txn.currency,
    order_id: txn.order?.id ?? null,
    message: txn.data?.message ?? null,
  };

  if (succeeded && amountOk) {
    const { data: updated } = await admin
      .from("payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        provider_txn_id: txnId,
        provider_order_id: txn.order?.id != null ? String(txn.order.id) : undefined,
        callback,
        error: null,
      })
      .eq("id", payment.id)
      .neq("status", "paid")
      .select("id");
    if (!updated?.length) return "paid"; // already applied earlier

    if (payment.kind === "pro_annual") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("current_period_end, status")
        .eq("user_id", payment.user_id)
        .maybeSingle<{ current_period_end: string; status: string }>();
      const now = new Date();
      const from =
        sub && sub.status === "active" && new Date(sub.current_period_end) > now ? new Date(sub.current_period_end) : now;
      const end = new Date(from);
      end.setFullYear(end.getFullYear() + 1);
      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id: payment.user_id,
          plan_id: "pro_annual",
          status: "active",
          current_period_start: sub && from > now ? undefined : now.toISOString(),
          current_period_end: end.toISOString(),
          last_payment_id: payment.id,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    } else if (payment.inspection_id) {
      const { error } = await admin
        .from("inspection_unlocks")
        .upsert(
          { inspection_id: payment.inspection_id, user_id: payment.user_id, payment_id: payment.id },
          { onConflict: "inspection_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    }
    return "paid";
  }

  if (settled && payment.status === "pending") {
    await admin
      .from("payments")
      .update({
        status: "failed",
        provider_txn_id: txnId,
        callback,
        error: succeeded && !amountOk ? "amount_mismatch" : (txn.data?.message ?? "declined").slice(0, 200),
      })
      .eq("id", payment.id)
      .eq("status", "pending");
    return "failed";
  }
  return "ignored";
}
