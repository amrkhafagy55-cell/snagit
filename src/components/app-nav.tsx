"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Settings, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

function useLinks(isAdmin: boolean) {
  const { t } = useI18n();
  const links = [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard, match: ["/dashboard", "/inspections"] },
    { href: "/properties/new", label: t.nav.newInspection, icon: PlusCircle, match: ["/properties"] },
    { href: "/settings", label: t.nav.settings, icon: Settings, match: ["/settings"] },
  ];
  if (isAdmin) links.push({ href: "/admin", label: t.nav.admin, icon: ShieldCheck, match: ["/admin"] });
  return links;
}

function isActive(path: string, match: string[]) {
  return match.some((m) => path === m || path.startsWith(m + "/"));
}

export function DesktopNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const path = usePathname();
  const links = useLinks(isAdmin);
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

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const path = usePathname();
  const links = useLinks(isAdmin);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className={`grid ${links.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
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
