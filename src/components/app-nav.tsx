"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

function useLinks() {
  const { t } = useI18n();
  return [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard, match: ["/dashboard", "/inspections"] },
    { href: "/properties/new", label: t.nav.newInspection, icon: PlusCircle, match: ["/properties"] },
    { href: "/settings", label: t.nav.settings, icon: Settings, match: ["/settings"] },
  ];
}

function isActive(path: string, match: string[]) {
  return match.some((m) => path === m || path.startsWith(m + "/"));
}

export function DesktopNav() {
  const path = usePathname();
  const links = useLinks();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = isActive(path, match);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              active ? "bg-navy-900 text-white" : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  const links = useLinks();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-3">
        {links.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(path, match);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${active ? "text-accent-600" : "text-navy-500"}`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
