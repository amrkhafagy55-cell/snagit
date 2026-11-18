"use server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/supabase/env";
import { checkoutUrl, createIntention, isPaymentsEnabled, PaymobError } from "@/lib/payments/paymob";
import type { ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";

const schema = z.object({
  kind: z.enum(["pro_annual", "report"]),
  inspectionId: z.uuid().nullable(),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{8,15}$/, "phone")),
});

/**
 * Starts a Paymob checkout. Creates a pending payment, asks Paymob for an intention and
 * returns the hosted checkout URL. Nothing is granted here — only the verified webhook does that.
 */
export async function startCheckoutAction(raw: z.input<typeof schema>): Promise<ActionResult<{ url: string }>> {
  if (!isPaymentsEnabled()) return { ok: false, error: "paymentsDisabled" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "validation", fieldErrors: { phone: "phone" } };
  }
  const v = parsed.data;
  try {
    const { user, supabase } = await authed();
    if (v.kind === "report" && !v.inspectionId) throw new ActionError("invalid");

    const [{ data: plan }, { data: profile }] = await Promise.all([
      supabase.from("plans").select("id, name_en, price_cents, currency, is_active").eq("id", v.kind).maybeSingle(),
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    ]);
    if (!plan || !plan.is_active || plan.price_cents <= 0) throw new ActionError("invalid");

    let itemDescription = "SNAGIT Pro — 12 months";
    if (v.kind === "report") {
      const { data: insp } = await supabase
        .from("inspections")
        .select("id, properties(project_name)")
        .eq("id", v.inspectionId!)
        .maybeSingle();
      if (!insp) throw new ActionError("notFound");
      const { data: unlocked } = await supabase.rpc("inspection_unlocked", { p_inspection: v.inspectionId });
      if (unlocked === true) throw new ActionError("alreadyUnlocked");
      const name = (insp.properties as unknown as { project_name: string } | null)?.project_name ?? "";
      itemDescription = `SNAGIT inspection report — ${name}`.slice(0, 120);
    }

    if (!profile?.phone) {
      await supabase.from("profiles").update({ phone: v.phone }).eq("id", user.id);
    }

    const admin = createAdminClient();
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        kind: v.kind,
        inspection_id: v.kind === "report" ? v.inspectionId : null,
        amount_cents: plan.price_cents,
        currency: plan.currency,
        status: "pending",
        provider: "paymob",
      })
      .select("id")
      .single();
    if (payErr || !payment) throw payErr ?? new Error("payment insert failed");

    const [first, ...rest] = (profile?.full_name || "SNAGIT User").trim().split(/\s+/);
    try {
      const intention = await createIntention({
        amountCents: plan.price_cents,
        currency: plan.currency,
        itemName: plan.name_en,
        itemDescription,
        specialReference: payment.id,
        billing: { firstName: first || "SNAGIT", lastName: rest.join(" ") || "User", email: user.email, phone: v.phone },
        notificationUrl: `${siteUrl()}/api/payments/paymob/webhook`,
        redirectionUrl: `${siteUrl()}/billing/return`,
      });
      await admin
        .from("payments")
        .update({ provider_intention_id: intention.intentionId, provider_order_id: intention.orderId })
        .eq("id", payment.id);
      return { ok: true, data: { url: checkoutUrl(intention.clientSecret) } };
    } catch (e) {
      await admin.from("payments").update({ status: "failed", error: "intention_failed" }).eq("id", payment.id);
      if (e instanceof PaymobError) {
        console.error("[paymob]", e.message);
        throw new ActionError("paymentStartFailed");
      }
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
