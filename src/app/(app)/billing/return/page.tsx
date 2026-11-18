import type { Metadata } from "next";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Payment status" };

/**
 * Paymob redirects here after checkout. This page only READS our records (RLS: own payments);
 * the status is set by the HMAC-verified webhook, which may arrive a few seconds later.
 */
export default async function PaymentReturnPage({ searchParams }: PageProps<"/billing/return">) {
  const sp = await searchParams;
  const ref = typeof sp.merchant_order_id === "string" ? sp.merchant_order_id : null;
  const [{ t }, supabase] = await Promise.all([getI18n(), createClient()]);
  const b = t.billing;

  type PaymentView = { status: "pending" | "paid" | "failed"; kind: string; inspection_id: string | null };
  let payment = null as PaymentView | null;
  if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
    const { data } = await supabase.from("payments").select("status, kind, inspection_id").eq("id", ref).maybeSingle();
    payment = data as typeof payment;
  }

  const view = !payment
    ? { icon: XCircle, tone: "text-navy-400", text: b.returnUnknown }
    : payment.status === "paid"
      ? { icon: CheckCircle2, tone: "text-emerald-600", text: b.returnPaid }
      : payment.status === "failed"
        ? { icon: XCircle, tone: "text-red-600", text: b.returnFailed }
        : { icon: Clock, tone: "text-amber-600", text: b.returnPending };
  const Icon = view.icon;
  const next =
    payment?.status === "paid" && payment.kind === "report" && payment.inspection_id
      ? `/inspections/${payment.inspection_id}/report`
      : "/billing";

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="card p-8 text-center">
        <Icon className={`mx-auto size-14 ${view.tone}`} aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-navy-950">{b.returnTitle}</h1>
        <p className="mt-2 text-navy-600" aria-live="polite">{view.text}</p>
        {payment?.status === "pending" && <AutoRefresh />}
        <LinkButton href={next} className="mt-6">
          {payment?.status === "paid" && payment.kind === "report" ? t.report.title : b.backToBilling}
        </LinkButton>
      </div>
    </div>
  );
}
