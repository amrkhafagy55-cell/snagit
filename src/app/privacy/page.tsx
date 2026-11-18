import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalArticle, LegalShell, type LegalDoc } from "@/components/legal-shell";
import type { Lang } from "@/lib/types";

export const metadata: Metadata = { title: "Privacy policy" };

// Draft pending legal review. Keep it true to what the code does: update it with any change to
// data collection, processors (Supabase, Vercel, Paymob, Anthropic) or admin access.
const DOCS: Record<Lang, LegalDoc> = {
  en: {
    title: "Privacy policy",
    intro: "SNAGIT helps you inspect a property and document its defects. This policy explains what we collect, why, who can see it, and the choices you have.",
    sections: [
      {
        h: "What we collect",
        p: [
          "Account details: your name, email address, and optionally your phone number, company and account type (individual or inspector), plus your language preference.",
          "Inspection content you enter: property details (project, developer, unit numbers, address, owner name), checklists, defects, photos, floor plans and the PDF reports generated from them.",
          "Payment records: plan, amount, status and the Paymob transaction reference. Card or wallet details are entered on Paymob's page; we never receive or store them.",
          "Technical data: a sign-in session cookie, a language cookie, and standard server logs (such as IP address and time of request) kept for security and troubleshooting.",
        ],
      },
      {
        h: "How we use it",
        p: [
          "To run the service: store your inspections, build your reports, apply your plan's limits, process payments and answer support requests.",
          "To keep SNAGIT secure and working, and to understand usage through aggregated counts (for example, the number of reports generated per day). We don't sell your data and we don't use it for advertising.",
        ],
      },
      {
        h: "Who can see your data",
        p: [
          "You. Each inspection is private to the account that created it; database rules enforce this.",
          "People you share a report link with can download that report version until the link expires or you revoke it.",
          "SNAGIT administrators can see account details, plans and payments, and inspection metadata (project name, status, dates and defect counts) for support and billing. They can't see defect descriptions, photos or report contents.",
          "Service providers that process data for us: Supabase (database, file storage and sign-in, hosted in the EU, Ireland), Vercel (web hosting), Paymob (payments) and, only when you use the optional AI assistant, Anthropic (the photos and text you send for a suggestion).",
        ],
      },
      {
        h: "How long we keep it",
        p: [
          "Your content stays while your account is active or until you delete it. Deleting an inspection deletes its defects, photos and reports; deleting your account deletes everything. Payment records are kept, without your name or contact details, as long as accounting and tax rules require.",
        ],
      },
      {
        h: "Your rights",
        p: [
          "You can view and edit your profile and content in the app at any time. You can delete your account yourself under Settings → Delete account: it removes your profile, inspections, photos, floor plans, reports and share links straight away, and keeps payment records only without your name or contact details. To get a copy of your data or correct it, contact us. We'll respond in line with Egypt's Personal Data Protection Law (Law No. 151 of 2020).",
        ],
      },
      {
        h: "Security",
        p: [
          "Data travels over encrypted connections. Files are stored in private storage and opened through short-lived signed links. No system is perfectly secure, so please use a strong password and keep it private.",
        ],
      },
      {
        h: "Cookies",
        p: ["We only use cookies needed to keep you signed in and remember your language. There are no advertising or tracking cookies."],
      },
      {
        h: "Changes and contact",
        p: ["If we change this policy we'll update this page and the date below. Questions? See the Contact page."],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    intro: "يساعدك SNAGIT على فحص العقار وتوثيق عيوبه. توضح هذه السياسة ما نجمعه ولماذا، ومن يمكنه رؤيته، والخيارات المتاحة لك.",
    sections: [
      {
        h: "ما الذي نجمعه",
        p: [
          "بيانات الحساب: اسمك وبريدك الإلكتروني، واختياريًا رقم هاتفك وشركتك ونوع الحساب (فرد أو مفتش)، بالإضافة إلى اللغة المفضلة.",
          "محتوى الفحص الذي تدخله: بيانات العقار (المشروع والمطور وأرقام الوحدة والعنوان واسم المالك)، وقوائم الفحص، والعيوب، والصور، والمساقط، وتقارير PDF الناتجة عنها.",
          "سجلات الدفع: الباقة والمبلغ والحالة ورقم العملية لدى Paymob. بيانات البطاقة أو المحفظة تُدخل في صفحة Paymob، ولا نستلمها أو نخزنها أبدًا.",
          "بيانات تقنية: ملف تعريف (cookie) لجلسة الدخول، وآخر للغة، وسجلات الخادم المعتادة (مثل عنوان IP ووقت الطلب) لأغراض الأمان وحل المشكلات.",
        ],
      },
      {
        h: "كيف نستخدمها",
        p: [
          "لتشغيل الخدمة: حفظ فحوصاتك، وإنشاء تقاريرك، وتطبيق حدود باقتك، ومعالجة المدفوعات، والرد على طلبات الدعم.",
          "للحفاظ على أمان SNAGIT وعمله، ولفهم الاستخدام من خلال أعداد إجمالية (مثل عدد التقارير المنشأة يوميًا). لا نبيع بياناتك ولا نستخدمها في الإعلانات.",
        ],
      },
      {
        h: "من يمكنه رؤية بياناتك",
        p: [
          "أنت. كل فحص خاص بالحساب الذي أنشأه، وقواعد قاعدة البيانات تفرض ذلك.",
          "من تشاركه رابط تقرير يمكنه تحميل نسخة التقرير هذه حتى تنتهي صلاحية الرابط أو تلغيه.",
          "مديرو SNAGIT يمكنهم رؤية بيانات الحساب والباقات والمدفوعات، والبيانات العامة للفحوصات (اسم المشروع والحالة والتواريخ وعدد العيوب) لأغراض الدعم والفوترة، ولا يمكنهم رؤية وصف العيوب أو الصور أو محتوى التقارير.",
          "مقدمو خدمات يعالجون البيانات لصالحنا: Supabase (قاعدة البيانات وتخزين الملفات وتسجيل الدخول، مستضافة في الاتحاد الأوروبي - أيرلندا)، وVercel (استضافة الموقع)، وPaymob (المدفوعات)، وAnthropic فقط عند استخدامك للمساعد الذكي الاختياري (الصور والنصوص التي ترسلها لطلب اقتراح).",
        ],
      },
      {
        h: "مدة الاحتفاظ بالبيانات",
        p: [
          "يبقى محتواك طالما حسابك نشط أو حتى تحذفه. حذف الفحص يحذف عيوبه وصوره وتقاريره، وحذف الحساب يحذف كل شيء. نحتفظ بسجلات الدفع، بدون اسمك أو بيانات التواصل معك، للمدة التي تتطلبها قواعد المحاسبة والضرائب.",
        ],
      },
      {
        h: "حقوقك",
        p: [
          "يمكنك عرض وتعديل ملفك الشخصي ومحتواك داخل التطبيق في أي وقت. ويمكنك حذف حسابك بنفسك من الإعدادات ← حذف الحساب: يحذف ذلك فورًا ملفك الشخصي وفحوصاتك وصورك ومساقطك وتقاريرك وروابط المشاركة، ولا يُبقي إلا سجلات الدفع بدون اسمك أو بيانات التواصل معك. للحصول على نسخة من بياناتك أو تصحيحها، تواصل معنا. سنرد وفقًا لقانون حماية البيانات الشخصية المصري (القانون رقم 151 لسنة 2020).",
        ],
      },
      {
        h: "الأمان",
        p: [
          "تنتقل البيانات عبر اتصالات مشفرة. تُحفظ الملفات في مساحة تخزين خاصة وتُفتح عبر روابط موقّعة قصيرة الصلاحية. لا يوجد نظام آمن بشكل كامل، لذا استخدم كلمة مرور قوية واحتفظ بها لنفسك.",
        ],
      },
      {
        h: "ملفات تعريف الارتباط (Cookies)",
        p: ["نستخدم فقط الملفات اللازمة لإبقائك مسجلًا للدخول وتذكر لغتك. لا توجد ملفات إعلانية أو تتبعية."],
      },
      {
        h: "التغييرات والتواصل",
        p: ["إذا غيّرنا هذه السياسة سنحدّث هذه الصفحة والتاريخ أدناه. لديك سؤال؟ راجع صفحة التواصل."],
      },
    ],
  },
};

export default async function PrivacyPage() {
  const { t, lang } = await getI18n();
  return (
    <LegalShell t={t} lang={lang}>
      <LegalArticle doc={DOCS[lang]} />
    </LegalShell>
  );
}
