"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { saveTemplateAction, setTemplateActiveAction } from "../../_actions/admin";
import type { RoomType } from "@/lib/types";

export type TemplateRow = {
  id: string;
  room_type: RoomType;
  category: string;
  title_en: string;
  title_ar: string;
  sort_order: number;
  is_active: boolean;
};

type Draft = Omit<TemplateRow, "id" | "is_active"> & { id: string | null };

function TemplateForm({
  initial,
  categories,
  onDone,
  submitLabel,
}: {
  initial: Draft;
  categories: { key: string; label: string }[];
  onDone: () => void;
  submitLabel: string;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pre = initial.id ?? "new";
  return (
    <form
      className="grid gap-3 sm:grid-cols-12"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveTemplateAction(v);
          if (!res.ok) return setError(res.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <Field label={t.admin.titleEn} htmlFor={`${pre}-en`} className="sm:col-span-5">
        <input id={`${pre}-en`} required maxLength={200} className="field-input" value={v.title_en} onChange={(e) => setV({ ...v, title_en: e.target.value })} />
      </Field>
      <Field label={t.admin.titleAr} htmlFor={`${pre}-ar`} className="sm:col-span-5">
        <input id={`${pre}-ar`} required dir="rtl" maxLength={200} className="field-input" value={v.title_ar} onChange={(e) => setV({ ...v, title_ar: e.target.value })} />
      </Field>
      <Field label={t.admin.order} htmlFor={`${pre}-order`} className="sm:col-span-2">
        <input
          id={`${pre}-order`}
          inputMode="numeric"
          dir="ltr"
          className="field-input"
          value={v.sort_order}
          onChange={(e) => setV({ ...v, sort_order: Number(e.target.value.replace(/\D/g, "")) || 0 })}
        />
      </Field>
      <Field label={t.admin.category} htmlFor={`${pre}-cat`} className="sm:col-span-5">
        <select id={`${pre}-cat`} className="field-input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end gap-2 sm:col-span-7 sm:justify-end">
        {error && <p className="me-auto self-center text-sm text-red-600">{errorText(error)}</p>}
        {initial.id && (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t.app.cancel}
          </Button>
        )}
        <Button type="submit" variant={initial.id ? "primary" : "accent"} loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function TemplateItem({ row, categories, categoryLabel }: { row: TemplateRow; categories: { key: string; label: string }[]; categoryLabel: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    const cats = categories.some((c) => c.key === row.category) ? categories : [...categories, { key: row.category, label: categoryLabel }];
    return (
      <li className="bg-navy-50/50 px-4 py-4">
        <TemplateForm initial={row} categories={cats} onDone={() => setEditing(false)} submitLabel={t.app.save} />
      </li>
    );
  }
  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${row.is_active ? "" : "bg-navy-50/40"}`}>
      <span className="w-10 shrink-0 text-xs text-navy-400" dir="ltr">
        {row.sort_order}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${row.is_active ? "text-navy-900" : "text-navy-400 line-through"}`}>{row.title_en}</p>
        <p dir="rtl" className={`text-start text-sm ${row.is_active ? "text-navy-600" : "text-navy-400"}`}>
          {row.title_ar}
        </p>
      </div>
      <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-600">{categoryLabel}</span>
      {!row.is_active && <span className="text-xs font-semibold text-navy-400">{t.admin.hiddenLabel}</span>}
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`${t.app.edit}: ${row.title_en}`}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await setTemplateActiveAction(row.id, !row.is_active);
              if (!res.ok) setError(res.error);
              router.refresh();
            })
          }
        >
          {row.is_active ? t.admin.hide : t.admin.show}
        </Button>
      </div>
      {error && <p className="w-full text-sm text-red-600">{errorText(error)}</p>}
    </li>
  );
}

export function NewTemplate({ roomType, categories, nextOrder }: { roomType: RoomType; categories: { key: string; label: string }[]; nextOrder: number }) {
  const { t } = useI18n();
  const [k, setK] = useState(0);
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="mb-3 font-semibold text-navy-900">{t.admin.addItem}</h3>
      <TemplateForm
        key={k}
        initial={{ id: null, room_type: roomType, category: categories[0]?.key ?? "architectural", title_en: "", title_ar: "", sort_order: nextOrder }}
        categories={categories}
        onDone={() => setK((n) => n + 1)}
        submitLabel={t.admin.addItem}
      />
    </div>
  );
}
