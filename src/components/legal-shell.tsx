import Link from "next/link";
import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { fill, formatDate, type Dictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export type LegalSection = { h: string; p: ReactNode[] };
export type LegalDoc = { title: string; intro?: string; sections: LegalSection[] };

export const LEGAL_UPDATED = "2026-11-18";

export function LegalFooterLinks({ t, className = "" }: { t: Dictionary; className?: string }) {
  return (
    <nav aria-label={t.legal.footerLinks} className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 ${className}`}>
      <Link href="/privacy" className="hover:text-navy-900 hover:underline">{t.legal.privacy}</Link>
      <Link href="/terms" className="hover:text-navy-900 hover:underline">{t.legal.terms}</Link>
      <Link href="/refund" className="hover:text-navy-900 hover:underline">{t.legal.refund}</Link>
      <Link href="/contact" className="hover:text-navy-900 hover:underline">{t.legal.contact}</Link>
    </nav>
  );
}

export function LegalShell({ t, lang, children, draft = true }: { t: Dictionary; lang: Lang; children: ReactNode; draft?: boolean }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="border-b border-navy-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SNAGIT">
            <Logo />
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {draft && (
          <p className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.legal.draft}
          </p>
        )}
        {children}
        {draft && <p className="mt-10 text-sm text-navy-400">{fill(t.legal.updated, { date: formatDate(LEGAL_UPDATED, lang) })}</p>}
      </main>
      <footer className="border-t border-navy-100 py-6 text-sm text-navy-500">
        <LegalFooterLinks t={t} />
        <p dir="ltr" className="mt-2 text-center">© {LEGAL_UPDATED.slice(0, 4)} SNAGIT</p>
      </footer>
    </div>
  );
}

export function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-navy-950">{doc.title}</h1>
      {doc.intro && <p className="mt-3 text-lg leading-relaxed text-navy-600">{doc.intro}</p>}
      {doc.sections.map((s, i) => (
        <section key={i} className="mt-8">
          <h2 className="text-lg font-bold text-navy-900">{s.h}</h2>
          {s.p.map((para, j) => (
            <p key={j} className="mt-2 leading-relaxed text-navy-700">
              {para}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
