import Link from "next/link";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-navy-50 to-white">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="SNAGIT">
          <Logo />
        </Link>
        <LanguageToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        {isSupabaseConfigured() ? <div className="w-full max-w-md">{children}</div> : <SetupNotice />}
      </main>
    </div>
  );
}
