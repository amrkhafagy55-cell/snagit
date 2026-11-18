import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalArticle, LegalShell, type LegalDoc } from "@/components/legal-shell";
import type { Lang } from "@/lib/types";

export const metadata: Metadata = { title: "Terms of use" };

// Draft pending legal review. Plan facts (no auto-renewal, per-inspection unlock) must match the billing code.
const DOCS: Record<Lang, LegalDoc> = {
  en: {
    title: "Terms of use",
    intro: "By creating an account or using SNAGIT you agree to these terms. Please read them with the Privacy policy and the Refund policy.",
    sections: [
      {
        h: "The service",
        p: [
          "SNAGIT is a tool for recording the condition of a property: checklists, defects, photos, floor-plan pins and PDF reports. You decide what to inspect and what to record.",
        ],
      },
      {
        h: "Your account",
        p: [
          "Give accurate details and keep your password private. You're responsible for what happens under your account. Tell us straight away if you think someone else has access to it.",
        ],
      },
      {
        h: "Inspection findings and reports",
        p: [
          "Findings and reports reflect what you or your inspector recorded. SNAGIT doesn't visit the property and doesn't certify a unit. A report is not a structural, electrical or legal opinion from a licensed professional; get one where safety or a large decision depends on it.",
          "Suggestions from the optional AI assistant are preliminary. They appear only after you ask, and nothing is saved until you review and accept it.",
        ],
      },
      {
        h: "Your content",
        p: [
          "You own the content you upload. You give us permission to store, process and display it only as needed to run the service for you (for example, to build your reports or deliver a share link you create).",
          "Only record properties you're entitled to inspect, and don't upload unlawful content or other people's personal data without a right to do so.",
        ],
      },
      {
        h: "Plans and payments",
        p: [
          "The Free plan has the limits shown on the Plans page. Pro gives the listed features for 12 months from the date of payment and does not renew automatically. A single-report purchase unlocks one inspection.",
          "Prices are in Egyptian pounds as shown at checkout. Payments are processed by Paymob. A plan is activated only after Paymob confirms the payment to us.",
        ],
      },
      {
        h: "Acceptable use",
        p: [
          "Don't try to access other users' data, break or overload the service, get around plan limits, or use SNAGIT to harass or mislead anyone. We may suspend accounts that do.",
        ],
      },
      {
        h: "Availability and liability",
        p: [
          "We work to keep SNAGIT available and your data safe, but the service is provided as is. To the extent the law allows, we aren't liable for indirect losses, or for decisions made on the basis of a report. Keep your own copy of important reports.",
        ],
      },
      {
        h: "Ending your use",
        p: [
          "You can stop using SNAGIT at any time and ask us to delete your account. We may end accounts that break these terms.",
        ],
      },
      {
        h: "Law and changes",
        p: [
          "These terms are governed by the laws of the Arab Republic of Egypt. If we change them, we'll update this page; continuing to use SNAGIT after a change means you accept it.",
        ],
      },
    ],
  },
  ar: {
    title: "شروط الاستخدام",
    intro: "بإنشاء حساب أو استخدام SNAGIT فإنك توافق على هذه الشروط. يُرجى قراءتها مع سياسة الخصوصية وسياسة الاسترداد.",
    sections: [
      {
        h: "الخدمة",
        p: [
          "SNAGIT أداة لتسجيل حالة العقار: قوائم الفحص والعيوب والصور وتحديد المواقع على المسقط وتقارير PDF. أنت من يقرر ما يتم فحصه وما يتم تسجيله.",
        ],
      },
      {
        h: "حسابك",
        p: [
          "أدخل بيانات صحيحة واحتفظ بكلمة المرور لنفسك. أنت مسؤول عما يحدث من خلال حسابك. أبلغنا فورًا إذا اعتقدت أن شخصًا آخر يستطيع الدخول إليه.",
        ],
      },
      {
        h: "نتائج الفحص والتقارير",
        p: [
          "تعكس النتائج والتقارير ما سجلته أنت أو المفتش الخاص بك. SNAGIT لا يزور العقار ولا يعتمد الوحدة. التقرير ليس رأيًا إنشائيًا أو كهربائيًا أو قانونيًا من متخصص مرخّص؛ استعن بمتخصص عندما تتوقف السلامة أو قرار كبير على ذلك.",
          "اقتراحات المساعد الذكي الاختياري مبدئية، تظهر فقط عند طلبك، ولا يُحفظ شيء منها قبل أن تراجعه وتقبله.",
        ],
      },
      {
        h: "محتواك",
        p: [
          "المحتوى الذي ترفعه ملكك. تمنحنا الإذن بتخزينه ومعالجته وعرضه فقط بالقدر اللازم لتقديم الخدمة لك (مثل إنشاء تقاريرك أو تفعيل رابط مشاركة تنشئه).",
          "سجّل فقط العقارات التي يحق لك فحصها، ولا ترفع محتوى مخالفًا للقانون أو بيانات شخصية لآخرين دون حق في ذلك.",
        ],
      },
      {
        h: "الباقات والمدفوعات",
        p: [
          "للباقة المجانية الحدود الموضحة في صفحة الباقات. باقة Pro تمنح المزايا المذكورة لمدة 12 شهرًا من تاريخ الدفع ولا تتجدد تلقائيًا. شراء تقرير واحد يفتح فحصًا واحدًا.",
          "الأسعار بالجنيه المصري كما تظهر عند الدفع. تتم معالجة المدفوعات عبر Paymob، ولا تُفعّل الباقة إلا بعد أن يؤكد لنا Paymob الدفع.",
        ],
      },
      {
        h: "الاستخدام المقبول",
        p: [
          "لا تحاول الوصول إلى بيانات مستخدمين آخرين أو تعطيل الخدمة أو إثقالها أو التحايل على حدود الباقات، ولا تستخدم SNAGIT لمضايقة أي شخص أو تضليله. قد نوقف الحسابات التي تفعل ذلك.",
        ],
      },
      {
        h: "الإتاحة والمسؤولية",
        p: [
          "نعمل على إبقاء SNAGIT متاحًا وبياناتك آمنة، لكن الخدمة تُقدَّم كما هي. وفي الحدود التي يسمح بها القانون، لا نتحمل المسؤولية عن الخسائر غير المباشرة أو عن القرارات المتخذة بناءً على تقرير. احتفظ بنسخة خاصة بك من التقارير المهمة.",
        ],
      },
      {
        h: "إنهاء الاستخدام",
        p: ["يمكنك التوقف عن استخدام SNAGIT في أي وقت وطلب حذف حسابك. وقد ننهي الحسابات المخالفة لهذه الشروط."],
      },
      {
        h: "القانون والتعديلات",
        p: [
          "تخضع هذه الشروط لقوانين جمهورية مصر العربية. إذا عدّلناها سنحدّث هذه الصفحة، واستمرارك في استخدام SNAGIT بعد التعديل يعني قبوله.",
        ],
      },
    ],
  },
};

export default async function TermsPage() {
  const { t, lang } = await getI18n();
  return (
    <LegalShell t={t} lang={lang}>
      <LegalArticle doc={DOCS[lang]} />
    </LegalShell>
  );
}
