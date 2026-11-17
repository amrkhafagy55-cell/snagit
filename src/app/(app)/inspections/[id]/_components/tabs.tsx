"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export function InspectionTabs({ id, defectCount }: { id: string; defectCount: number }) {
  const { t } = useI18n();
  const path = usePathname();
  const base = `/inspections/${id}`;
  const tabs: { href: string; label: string; active: boolean; count?: number }[] = [
    { href: base, label: t.workspace.overview, active: path === base || path.startsWith(`${base}/rooms`) },
    { href: `${base}/plan`, label: t.plan.tab, active: path.startsWith(`${base}/plan`) },
    { href: `${base}/defects`, label: t.workspace.defects, active: path.startsWith(`${base}/defects`), count: defectCount },
  ];
  return (
    <nav className="mt-5 flex gap-1 border-b border-navy-100" aria-label={t.workspace.overview}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
            tab.active ? "border-accent-500 text-navy-950" : "border-transparent text-navy-500 hover:text-navy-800"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${tab.active ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-600"}`}>
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
