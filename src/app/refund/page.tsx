import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalArticle, LegalShell, type LegalDoc } from "@/components/legal-shell";
import type { Lang } from "@/lib/types";

export const metadata: Metadata = { title: "Refund policy" };

// Draft: the 14-day windows and conditions are a proposal waiting for the product owner's decision.
// Refunds are made by hand in the Paymob dashboard; Admin → Users ends Pro after a refund.
const DOCS: Record<Lang, LegalDoc> = {
  en: {
    title: "Refund policy",
    intro: "We want you to be happy with what you paid for. This is how refunds work.",
    sections: [
      {
        h: "Pro (annual)",
        p: ["Ask within 14 days of payment for a full refund. Pro access ends when the refund is issued."],
      },
      {
        h: "Single report (one inspection)",
        p: [
          "Ask within 14 days of payment for a full refund if you haven't generated a report for that inspection since unlocking it. After a full report has been generated, the purchase can't be refunded.",
        ],
      },
      {
        h: "Double or failed charges",
        p: ["If you were charged twice, or charged for a payment that the app shows as failed, we refund the extra charge in full."],
      },
      {
        h: "How to ask",
        p: [
          "Contact us from the email on your account with the date and amount of the payment (the Paymob reference helps). Approved refunds go back to the card or wallet you paid with; the time it takes to appear depends on your bank or wallet provider, usually 5–14 business days.",
        ],
      },
    ],
  },
  ar: {
    title: "سياسة الاسترداد",
    intro: "نريدك أن تكون راضيًا عما دفعت مقابله. هكذا يتم الاسترداد.",
    sections: [
      {
        h: "باقة Pro (سنوية)",
        p: ["اطلب الاسترداد خلال 14 يومًا من الدفع لاسترداد المبلغ كاملًا. ينتهي اشتراك Pro عند تنفيذ الاسترداد."],
      },
      {
        h: "تقرير واحد (فحص واحد)",
        p: [
          "اطلب الاسترداد خلال 14 يومًا من الدفع لاسترداد المبلغ كاملًا إذا لم تُنشئ تقريرًا لهذا الفحص بعد فتحه. بعد إنشاء التقرير الكامل لا يمكن استرداد قيمة الشراء.",
        ],
      },
      {
        h: "الخصم المكرر أو الفاشل",
        p: ["إذا تم خصم المبلغ مرتين، أو خُصم مبلغ لعملية يظهرها التطبيق كفاشلة، نرد المبلغ الزائد بالكامل."],
      },
      {
        h: "كيف تطلب الاسترداد",
        p: [
          "تواصل معنا من البريد الإلكتروني المسجل في حسابك مع تاريخ ومبلغ العملية (رقم عملية Paymob يساعدنا). يُرد المبلغ المعتمد إلى البطاقة أو المحفظة التي دفعت بها، وتعتمد مدة ظهوره على البنك أو مزود المحفظة، وعادةً من 5 إلى 14 يوم عمل.",
        ],
      },
    ],
  },
};

export default async function RefundPage() {
  const { t, lang } = await getI18n();
  return (
    <LegalShell t={t} lang={lang}>
      <LegalArticle doc={DOCS[lang]} />
    </LegalShell>
  );
}
