"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { saveCategoryAction, setCategoryActiveAction } from "../../_actions/admin";

export type CategoryRow = { key: string; name_en: string; name_ar: string; sort_order: number; is_active: boolean };

export function CategoryItem({ row }: { row: CategoryRow }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [v, setV] = useState({ name_en: row.name_en, name_ar: row.name_ar, sort_order: row.sort_order });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = v.name_en !== row.name_en || v.name_ar !== row.name_ar || v.sort_order !== row.sort_order;

  return (
    <tr className={row.is_active ? "" : "bg-navy-50/40"}>
      <td className="px-4 py-3 align-middle">
        <code dir="ltr" className="text-xs text-navy-600">{row.key}</code>
        {!row.is_active && <p className="text-xs font-semibold text-navy-400">{t.admin.hiddenLabel}</p>}
      </td>
      <td className="px-2 py-3">
        <input aria-label={`${t.admin.nameEn} (${row.key})`} className="field-input h-9 py-0 text-sm" maxLength={60} value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
      </td>
      <td className="px-2 py-3">
        <input aria-label={`${t.admin.nameAr} (${row.key})`} dir="rtl" className="field-input h-9 py-0 text-sm" maxLength={60} value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} />
      </td>
      <td className="px-2 py-3">
        <input
          aria-label={`${t.admin.order} (${row.key})`}
          inputMode="numeric"
          dir="ltr"
          className="field-input h-9 w-20 py-0 text-sm"
          value={v.sort_order}
          onChange={(e) => setV({ ...v, sort_order: Number(e.target.value.replace(/\D/g, "")) || 0 })}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await saveCategoryAction({ key: row.key, ...v, isNew: false });
                setMsg(res.ok ? { ok: true, text: t.app.saved } : { ok: false, text: errorText(res.error) });
                router.refresh();
              })
            }
          >
            {t.app.save}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await setCategoryActiveAction(row.key, !row.is_active);
                if (!res.ok) setMsg({ ok: false, text: errorText(res.error) });
                router.refresh();
              })
            }
          >
            {row.is_active ? t.admin.hide : t.admin.show}
          </Button>
        </div>
        {msg && <p className={`mt-1 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      </td>
    </tr>
  );
}

export function NewCategory({ nextOrder }: { nextOrder: number }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const empty = { key: "", name_en: "", name_ar: "", sort_order: nextOrder };
  const [v, setV] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card grid gap-3 p-4 sm:grid-cols-12 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveCategoryAction({ ...v, isNew: true });
          if (!res.ok) return setError(res.error);
          setV({ ...empty, sort_order: v.sort_order + 10 });
          router.refresh();
        });
      }}
    >
      <h3 className="font-semibold text-navy-900 sm:col-span-12">{t.admin.addCategory}</h3>
      <label className="sm:col-span-3">
        <span className="field-label">{t.admin.key}</span>
        <input
          required
          dir="ltr"
          pattern="[a-z][a-z0-9_]{1,39}"
          maxLength={40}
          className="field-input"
          value={v.key}
          onChange={(e) => setV({ ...v, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
          aria-describedby="cat-key-hint"
        />
        <span id="cat-key-hint" className="mt-1 block text-xs text-navy-400">
          {t.admin.keyHint}
        </span>
      </label>
      <label className="sm:col-span-4">
        <span className="field-label">{t.admin.nameEn}</span>
        <input required maxLength={60} className="field-input" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
      </label>
      <label className="sm:col-span-4">
        <span className="field-label">{t.admin.nameAr}</span>
        <input required dir="rtl" maxLength={60} className="field-input" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} />
      </label>
      <label className="sm:col-span-1">
        <span className="field-label">{t.admin.order}</span>
        <input
          inputMode="numeric"
          dir="ltr"
          className="field-input"
          value={v.sort_order}
          onChange={(e) => setV({ ...v, sort_order: Number(e.target.value.replace(/\D/g, "")) || 0 })}
        />
      </label>
      <div className="flex items-center justify-end gap-3 sm:col-span-12">
        {error && <p className="me-auto text-sm text-red-600">{errorText(error)}</p>}
        <Button type="submit" variant="accent" loading={pending}>
          {t.admin.addCategory}
        </Button>
      </div>
    </form>
  );
}
