import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { fill, formatNumber, type Dictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export const PAGE_SIZE = 50;

/** Reads ?page= (1-based) into an offset. */
export function pageOffset(page: string | string[] | undefined): { page: number; offset: number } {
  const n = Math.max(1, Math.min(10_000, Number(Array.isArray(page) ? page[0] : page) || 1));
  return { page: n, offset: (n - 1) * PAGE_SIZE };
}

export function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function SearchForm({ action, q, placeholder, t, extra }: { action: string; q: string; placeholder: string; t: Dictionary; extra?: ReactNode }) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{t.admin.search}</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
        <input name="q" defaultValue={q} placeholder={placeholder} maxLength={100} className="field-input ps-9" />
      </label>
      {extra}
      <button type="submit" className="h-11 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800">
        {t.admin.search}
      </button>
    </form>
  );
}

export function Pager({ base, params, page, total, t, lang }: { base: string; params: Record<string, string>; page: number; total: number; t: Dictionary; lang: Lang }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const href = (p: number) => {
    const sp = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), page: String(p) });
    return `${base}?${sp.toString()}`;
  };
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-navy-500">
      <span>{fill(t.admin.showing, { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) })}</span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-lg border border-navy-200 px-3 py-1.5 font-semibold text-navy-700 hover:bg-navy-50">
            {t.app.previous}
          </Link>
        )}
        {to < total && (
          <Link href={href(page + 1)} className="rounded-lg border border-navy-200 px-3 py-1.5 font-semibold text-navy-700 hover:bg-navy-50">
            {t.app.next}
          </Link>
        )}
      </span>
    </div>
  );
}

/** Horizontally scrollable table shell for admin lists. */
export function AdminTable({ head, children, minWidth = 720 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-navy-100 bg-navy-50/60 text-start text-xs font-semibold uppercase tracking-wide text-navy-500">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 text-start">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-navy-700 ${className}`}>{children}</td>;
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm text-navy-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-navy-500">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold text-navy-900">{children}</h2>
      {hint && <p className="text-sm text-navy-500">{hint}</p>}
    </div>
  );
}
