import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getAppSettings } from "@/lib/settings";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = { title: "Contact" };

// Contact details come from Admin → Settings, so support can change them without a deploy.
export default async function ContactPage() {
  const { t, lang } = await getI18n();
  const settings = isSupabaseConfigured() ? await getAppSettings() : null;
  const email = settings?.support_email.trim() ?? "";
  const whatsapp = (settings?.support_whatsapp ?? "").replace(/[^\d+]/g, "");
  const waNumber = whatsapp.replace(/^\+/, "").replace(/^0/, "20");

  return (
    <LegalShell t={t} lang={lang} draft={false}>
      <h1 className="text-3xl font-bold tracking-tight text-navy-950">{t.legal.contactTitle}</h1>
      <p className="mt-3 text-lg text-navy-600">{t.legal.contactBody}</p>
      {!email && !whatsapp ? (
        <p className="card mt-8 p-6 text-navy-500">{t.legal.contactSoon}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {email && (
            <a href={`mailto:${email}`} className="card flex items-center gap-4 p-5 transition hover:border-navy-200 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-xl bg-navy-900 text-white">
                <Mail className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm text-navy-500">{t.legal.email}</span>
                <span dir="ltr" className="block break-all font-semibold text-navy-900">{email}</span>
              </span>
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-center gap-4 p-5 transition hover:border-navy-200 hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-600 text-white">
                <MessageCircle className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm text-navy-500">{t.legal.whatsapp}</span>
                <span dir="ltr" className="block font-semibold text-navy-900">{whatsapp}</span>
              </span>
            </a>
          )}
        </div>
      )}
    </LegalShell>
  );
}
