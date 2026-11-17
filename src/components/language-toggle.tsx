"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLanguage } from "@/app/actions/preferences";
import { useI18n } from "@/lib/i18n/client";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await setLanguage(lang === "ar" ? "en" : "ar");
          router.refresh();
        })
      }
      disabled={pending}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60 ${className}`}
      lang={lang === "ar" ? "en" : "ar"}
    >
      <Languages className="size-4" aria-hidden />
      {t.app.switchLang}
    </button>
  );
}
