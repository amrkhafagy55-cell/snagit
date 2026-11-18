"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

const TABS = [
  { href: "/admin", key: "overview" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/inspections", key: "inspections" },
  { href: "/admin/billing", key: "billing" },
  { href: "/admin/checklists", key: "checklists" },
  { href: "/admin/categories", key: "categories" },
  { href: "/admin/settings", key: "settings" },
  { href: "/admin/activity", key: "activity" },
] as const;

export function AdminTabs() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <nav aria-label={t.admin.title} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-navy-100">
        {TABS.map(({ href, key }) => {
          const active = href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                active ? "border-accent-500 text-navy-950" : "border-transparent text-navy-500 hover:text-navy-900"
              }`}
            >
              {t.admin.tabs[key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
