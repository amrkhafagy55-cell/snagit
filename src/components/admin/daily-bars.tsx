import { fill, formatDate, formatNumber, type Dictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export type DailyPoint = { day: string; value: number };

/**
 * Single-series daily bar chart (30 days). One hue (navy-500, validated against the card surface),
 * bars anchored to the baseline with a 4px rounded top and a 2px gap, a hover/focus tooltip per day
 * with a full-height hit target, a one-line summary for screen readers and a table view.
 * Time runs left → right in both languages.
 */
export function DailyBars({ title, points, t, lang }: { title: string; points: DailyPoint[]; t: Dictionary; lang: Lang }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const total = points.reduce((n, p) => n + p.value, 0);
  const summary = fill(t.admin.chartSummary, { total: formatNumber(total, lang), max: formatNumber(max, lang) });
  const scale = max || 1;

  return (
    <figure className="card p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-navy-900">{title}</span>
        <span className="text-2xl font-bold tracking-tight text-navy-950">{formatNumber(total, lang)}</span>
      </figcaption>
      <p className="text-xs text-navy-500">{t.admin.last30}</p>

      <div dir="ltr" className="mt-4">
        <div className="relative h-32" role="img" aria-label={`${title}: ${summary}`}>
          {/* Recessive reference line at the peak */}
          {max > 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-navy-100">
              <span className="absolute -top-2.5 left-0 bg-white pe-1 text-[10px] font-medium text-navy-400">{formatNumber(max, lang)}</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-navy-200">
            {points.map((p, i) => {
              const h = p.value === 0 ? 0 : Math.max(3, (p.value / scale) * 100);
              const align = i < 4 ? "left-0" : i > points.length - 5 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={p.day} className="group relative flex h-full flex-1 items-end" aria-hidden>
                  <div
                    className="w-full rounded-t-[4px] bg-navy-500 transition-colors group-hover:bg-navy-800"
                    style={{ height: `${h}%` }}
                  />
                  <div
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-navy-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block ${align}`}
                  >
                    <span className="text-navy-200">{formatDate(p.day, lang)}</span>
                    <span className="ms-2 font-semibold">{formatNumber(p.value, lang)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-navy-400">
          <span>{formatDate(points[0]?.day, lang)}</span>
          <span>{formatDate(points[points.length - 1]?.day, lang)}</span>
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-navy-500 hover:text-navy-800">{t.admin.showTable}</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-navy-500">
              <th scope="col" className="py-1 text-start font-medium">{t.admin.day}</th>
              <th scope="col" className="py-1 text-end font-medium">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-navy-50">
                <td className="py-1 text-navy-600">{formatDate(p.day, lang)}</td>
                <td className="py-1 text-end font-medium text-navy-900">{formatNumber(p.value, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
