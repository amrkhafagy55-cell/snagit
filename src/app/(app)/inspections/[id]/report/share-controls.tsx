"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { fill, formatDate, formatNumber } from "@/lib/i18n";
import { createShareAction, revokeShareAction } from "../../../_actions/share";

const DAYS = [7, 30, 90] as const;

function CopyButton({ url }: { url: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt(t.share.copy, url);
        }
      }}
    >
      {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? t.share.copied : t.share.copy}
    </Button>
  );
}

/** "Share" on one report version: pick a validity, create the link, copy it. */
export function ShareButton({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<(typeof DAYS)[number]>(30);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Share2 className="size-4" aria-hidden />
        {t.share.button}
      </Button>
    );
  }
  return (
    <div className="w-full rounded-xl border border-navy-100 bg-navy-50/50 p-3">
      {url ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input readOnly dir="ltr" value={url} onFocus={(e) => e.target.select()} className="field-input h-9 flex-1 py-0 text-xs" aria-label={t.share.title} />
          <CopyButton url={url} />
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await createShareAction(reportId, days);
              if (!res.ok) return setError(res.error);
              setUrl(res.data.url);
              router.refresh();
            });
          }}
        >
          <label htmlFor={`days-${reportId}`} className="text-sm font-medium text-navy-700">
            {t.share.validFor}
          </label>
          <select
            id={`days-${reportId}`}
            className="field-input h-9 w-auto py-0 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as (typeof DAYS)[number])}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {fill(t.share.days, { n: d })}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" variant="accent" loading={pending}>
            {pending ? t.share.creating : t.share.create}
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t.app.cancel}
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{errorText(error)}</p>}
    </div>
  );
}

export type ShareRow = { id: string; url: string; expires_at: string; view_count: number; label: string };

export function ShareList({ shares }: { shares: ShareRow[] }) {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (shares.length === 0) return <p className="card p-4 text-sm text-navy-500">{t.share.none}</p>;
  return (
    <ul className="card divide-y divide-navy-100">
      {shares.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-navy-900">{s.label}</p>
            <p className="text-sm text-navy-500">
              {fill(t.share.expires, { date: formatDate(s.expires_at, lang) })} · {fill(t.share.downloads, { n: formatNumber(s.view_count, lang) })}
            </p>
          </div>
          <CopyButton url={s.url} />
          <Button
            size="sm"
            variant="danger"
            loading={pending && busy === s.id}
            onClick={() => {
              if (!window.confirm(t.share.revokeConfirm)) return;
              setBusy(s.id);
              setError(null);
              start(async () => {
                const res = await revokeShareAction(s.id);
                if (!res.ok) setError(res.error);
                router.refresh();
              });
            }}
          >
            {t.share.revoke}
          </Button>
        </li>
      ))}
      {error && <li className="p-4 text-sm text-red-600">{errorText(error)}</li>}
    </ul>
  );
}
