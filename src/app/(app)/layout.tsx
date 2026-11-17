import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { SetupNotice } from "@/components/setup-notice";
import { getProfile, requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <SetupNotice />
      </main>
    );
  }
  const user = await requireUser();
  const [profile, { t }] = await Promise.all([getProfile(), getI18n()]);
  const name = profile?.full_name || user.email;
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" aria-label={t.nav.dashboard}>
              <Logo />
            </Link>
            <DesktopNav />
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <Link
              href="/settings"
              className="ms-1 grid size-9 place-items-center rounded-full bg-accent-500 text-sm font-bold text-white"
              title={name}
              aria-label={t.nav.settings}
            >
              {initial}
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="grid size-9 place-items-center rounded-lg text-navy-500 hover:bg-navy-50 hover:text-navy-900"
                title={t.nav.signOut}
                aria-label={t.nav.signOut}
              >
                <LogOut className="flip-rtl size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12">{children}</main>
      <MobileNav />
    </div>
  );
}
