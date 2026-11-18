import Link from "next/link";
import { ArrowRight, Camera, ClipboardCheck, Languages, ListChecks } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { LinkButton } from "@/components/ui";
import { SeverityBadge, DefectStatusBadge } from "@/components/badges";
import { getI18n } from "@/lib/i18n/server";
import { getUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatPrice, getPlans } from "@/lib/billing";
import { Check } from "lucide-react";
import { LegalFooterLinks } from "@/components/legal-shell";

export default async function LandingPage() {
  const { t, lang } = await getI18n();
  const user = isSupabaseConfigured() ? await getUser() : null;
  const plans = isSupabaseConfigured() ? await getPlans().catch(() => []) : [];
  const priced = (id: string) => plans.find((p) => p.id === id);

  const features = [
    { icon: ListChecks, title: t.landing.f1Title, body: t.landing.f1Body },
    { icon: Camera, title: t.landing.f2Title, body: t.landing.f2Body },
    { icon: ClipboardCheck, title: t.landing.f3Title, body: t.landing.f3Body },
    { icon: Languages, title: t.landing.f4Title, body: t.landing.f4Body },
  ];
  const steps = [t.landing.how1, t.landing.how2, t.landing.how3, t.landing.how4];

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-navy-100/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SNAGIT">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            {user ? (
              <LinkButton href="/dashboard" size="sm">
                {t.nav.dashboard}
              </LinkButton>
            ) : (
              <>
                <Link href="/login" className="hidden h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50 sm:inline-flex">
                  {t.nav.signIn}
                </Link>
                <LinkButton href="/register" variant="accent" size="sm">
                  {t.nav.getStarted}
                </LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-navy-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <span className="inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700 ring-1 ring-accent-200">
                {t.app.tagline}
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-navy-950 sm:text-5xl">
                {t.landing.heroTitle}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-navy-600">{t.landing.heroSubtitle}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={user ? "/properties/new" : "/register"} variant="accent" size="lg">
                  {t.landing.ctaPrimary}
                  <ArrowRight className="flip-rtl size-5" aria-hidden />
                </LinkButton>
                {!user && (
                  <LinkButton href="/login" variant="secondary" size="lg">
                    {t.landing.ctaSecondary}
                  </LinkButton>
                )}
              </div>
            </div>

            {/* Product illustration (static, not interactive) */}
            <div aria-hidden className="relative">
              <div className="card rotate-[-1.5deg] p-5 shadow-xl shadow-navy-900/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-navy-400">{t.rooms.bedroom} 2</p>
                    <p className="font-semibold text-navy-900">
                      D-7 · {lang === "ar" ? "شرخ أعلى الشباك" : "Crack above window"}
                    </p>
                  </div>
                  <SeverityBadge severity="high" t={t} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {["from-stone-300 to-stone-400", "from-stone-200 to-stone-300", "from-zinc-300 to-zinc-400"].map((g) => (
                    <div key={g} className={`aspect-square rounded-xl bg-gradient-to-br ${g}`}>
                      <svg viewBox="0 0 100 100" className="size-full opacity-60">
                        <path d="M20 10 L35 40 L30 55 L50 75 L48 95" stroke="#57534e" strokeWidth="2" fill="none" />
                      </svg>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <DefectStatusBadge status="under_correction" t={t} />
                  <span className="text-navy-400">{t.categories.architectural}</span>
                </div>
              </div>
              <div className="card absolute -bottom-8 end-4 w-56 rotate-[2deg] p-4 shadow-lg shadow-navy-900/10 sm:end-[-1rem]">
                <p className="text-sm font-semibold text-navy-900">{t.workspace.progress}</p>
                <div className="mt-2 h-2 rounded-full bg-navy-100">
                  <div className="h-2 w-[72%] rounded-full bg-accent-500" />
                </div>
                <p className="mt-2 text-xs text-navy-500">72% · 64/89 {t.workspace.items}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy-950">{t.landing.featuresTitle}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card p-6">
                <div className="grid size-11 place-items-center rounded-xl bg-navy-900 text-white">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 font-semibold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-navy-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">{t.landing.howTitle}</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <li key={step} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <span className="grid size-9 place-items-center rounded-full bg-accent-500 font-bold">{i + 1}</span>
                  <p className="mt-4 font-medium leading-relaxed text-navy-100">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-sm text-navy-300">{t.landing.roadmapNote}</p>
          </div>
        </section>
      </main>

      {plans.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="pricing">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy-950">{t.billing.pricingTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-navy-500">{t.billing.pricingSubtitle}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { id: "free", title: t.billing.free, features: t.billing.freeFeatures, suffix: "", highlight: false },
              { id: "pro_annual", title: "Pro", features: t.billing.proFeatures, suffix: t.billing.perYear, highlight: true },
              { id: "report", title: lang === "ar" ? priced("report")?.name_ar : priced("report")?.name_en, features: t.billing.reportFeatures, suffix: t.billing.oneTime, highlight: false },
            ].map((card) => {
              const p = priced(card.id);
              if (!p) return null;
              return (
                <div key={card.id} className={`card flex flex-col p-6 ${card.highlight ? "border-2 border-accent-400 shadow-lg shadow-accent-500/10" : ""}`}>
                  <h3 className="text-lg font-bold text-navy-900">{card.title}</h3>
                  <p className="mt-2 text-3xl font-extrabold text-navy-950">
                    {formatPrice(p.price_cents, p.currency, lang)}
                    {card.suffix && <span className="ms-1 text-base font-medium text-navy-500">{card.suffix}</span>}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-navy-700">
                    {card.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <LinkButton href={user ? "/billing" : "/register"} variant={card.highlight ? "accent" : "secondary"} className="mt-6 w-full">
                    {user ? t.billing.seePlans : t.nav.getStarted}
                  </LinkButton>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="border-t border-navy-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-navy-500 sm:flex-row sm:px-6">
          <Logo className="scale-90" />
          <p>{t.landing.footer}</p>
          <p dir="ltr">© {new Date().getFullYear()} SNAGIT</p>
        </div>
        <LegalFooterLinks t={t} className="px-4 pb-8 text-sm text-navy-500" />
      </footer>
    </div>
  );
}
