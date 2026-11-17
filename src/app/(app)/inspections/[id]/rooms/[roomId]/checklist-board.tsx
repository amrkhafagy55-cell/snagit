"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, Minus, Plus, Trash2, X, AlertOctagon } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { categoryLabel, itemTitle } from "@/lib/i18n";
import { STANDARD_CATEGORIES, type ChecklistItem, type ChecklistResult } from "@/lib/types";
import {
  addChecklistItemAction,
  deleteChecklistItemAction,
  saveChecklistNoteAction,
  setChecklistResultAction,
} from "../../../../_actions/checklist";

const RESULT_BUTTONS: { value: ChecklistResult; icon: typeof Check; active: string }[] = [
  { value: "passed", icon: Check, active: "bg-emerald-500 text-white ring-emerald-500" },
  { value: "failed", icon: X, active: "bg-red-500 text-white ring-red-500" },
  { value: "not_inspected", icon: Minus, active: "bg-navy-200 text-navy-800 ring-navy-300" },
];

export function ChecklistBoard({
  inspectionId,
  roomId,
  initialItems,
  defectByItem,
}: {
  inspectionId: string;
  roomId: string;
  initialItems: ChecklistItem[];
  defectByItem: Record<string, { id: string; number: number }>;
}) {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [, start] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    return [...map.entries()];
  }, [items]);

  function setResult(item: ChecklistItem, result: ChecklistResult) {
    if (item.result === result) return;
    const previous = item.result;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, result } : i)));
    setError(null);
    start(async () => {
      const res = await setChecklistResultAction(item.id, result);
      if (!res.ok) {
        setItems((list) => list.map((i) => (i.id === item.id ? { ...i, result: previous } : i)));
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function remove(item: ChecklistItem) {
    if (!window.confirm(t.app.areYouSure)) return;
    setItems((list) => list.filter((i) => i.id !== item.id));
    start(async () => {
      const res = await deleteChecklistItemAction(item.id);
      if (!res.ok) {
        setError(res.error);
        setItems((list) => [...list, item].sort((a, b) => a.sort_order - b.sort_order));
      } else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{errorText(error)}</Alert>}
      {items.length === 0 && <p className="card p-6 text-center text-navy-500">{t.checklist.empty}</p>}

      {groups.map(([category, list]) => (
        <section key={category}>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-navy-400">{categoryLabel(category, t)}</h3>
          <ul className="card divide-y divide-navy-50">
            {list.map((item) => {
              const defect = defectByItem[item.id];
              return (
                <li key={item.id} className="p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-navy-900">
                        {itemTitle(item, lang)}
                        {item.is_custom && (
                          <span className="ms-2 rounded bg-navy-50 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-navy-500">
                            {t.checklist.custom}
                          </span>
                        )}
                      </p>
                      {item.notes && openNote !== item.id && <p className="mt-0.5 text-sm text-navy-500">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-xl bg-navy-50 p-1" role="radiogroup" aria-label={itemTitle(item, lang)}>
                        {RESULT_BUTTONS.map(({ value, icon: Icon, active }) => {
                          const on = item.result === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              title={t.results[value]}
                              onClick={() => setResult(item, value)}
                              className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-transparent transition sm:px-3 ${
                                on ? active : "text-navy-500 hover:bg-white"
                              }`}
                            >
                              <Icon className="size-4" aria-hidden />
                              <span className={value === "not_inspected" ? "sr-only" : "hidden sm:inline"}>{t.results[value]}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenNote(openNote === item.id ? null : item.id)}
                        className={`grid size-9 place-items-center rounded-lg hover:bg-navy-50 ${item.notes ? "text-navy-700" : "text-navy-300"}`}
                        title={t.checklist.notes}
                        aria-label={t.checklist.notes}
                        aria-expanded={openNote === item.id}
                      >
                        <MessageSquare className="size-4" />
                      </button>
                      {(
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          className="grid size-9 place-items-center rounded-lg text-navy-300 hover:bg-red-50 hover:text-red-600"
                          title={t.checklist.deleteItem}
                          aria-label={t.checklist.deleteItem}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {openNote === item.id && (
                    <NoteEditor
                      item={item}
                      onSaved={(notes) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, notes } : i)))}
                      onClose={() => setOpenNote(null)}
                    />
                  )}

                  {item.result === "failed" && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50/70 px-3 py-2 text-sm">
                      <AlertOctagon className="size-4 shrink-0 text-red-500" aria-hidden />
                      {defect ? (
                        <Link href={`/inspections/${inspectionId}/defects/${defect.id}`} className="font-semibold text-red-700 hover:underline">
                          {t.checklist.viewDefect} <span dir="ltr">D-{defect.number}</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/inspections/${inspectionId}/defects/new?room=${roomId}&item=${item.id}`}
                          className="font-semibold text-red-700 hover:underline"
                        >
                          {t.checklist.convert} →
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <AddItemForm
        roomId={roomId}
        categories={[...new Set([...STANDARD_CATEGORIES, ...items.map((i) => i.category)])]}
        onAdded={(item) => setItems((list) => [...list, item])}
      />
    </div>
  );
}

function NoteEditor({ item, onSaved, onClose }: { item: ChecklistItem; onSaved: (n: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [value, setValue] = useState(item.notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3">
      <textarea
        autoFocus
        rows={2}
        maxLength={2000}
        className="field-input text-sm"
        placeholder={t.checklist.addNote}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t.checklist.notes}
      />
      {error && <p className="field-error">{errorText(error)}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          {t.app.cancel}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await saveChecklistNoteAction(item.id, value);
              if (!res.ok) return setError(res.error);
              onSaved(value.trim());
              onClose();
            })
          }
        >
          {t.app.save}
        </Button>
      </div>
    </div>
  );
}

function AddItemForm({
  roomId,
  categories,
  onAdded,
}: {
  roomId: string;
  categories: string[];
  onAdded: (item: ChecklistItem) => void;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("architectural");
  const [customCategory, setCustomCategory] = useState("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const NEW = "__new__";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 p-4 text-sm font-semibold text-navy-500 hover:border-navy-400 hover:text-navy-800"
      >
        <Plus className="size-4" aria-hidden />
        {t.checklist.addItem}
      </button>
    );
  }

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const cat = category === NEW ? customCategory.trim() : category;
        const errs: Record<string, string> = {};
        if (!cat) errs.category = "required";
        if (!title.trim()) errs.title = "required";
        setErrors(errs);
        if (Object.keys(errs).length) return;
        start(async () => {
          const res = await addChecklistItemAction(roomId, cat, title);
          if (!res.ok) return setErrors(res.fieldErrors ?? { _: res.error });
          onAdded(res.data);
          setTitle("");
          titleRef.current?.focus();
          router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor="item-category" className="field-label">
            {t.checklist.category}
          </label>
          <select id="item-category" className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, t)}
              </option>
            ))}
            <option value={NEW}>{t.checklist.customCategory}</option>
          </select>
          {category === NEW && (
            <input
              className="field-input mt-2"
              placeholder={t.checklist.customCategoryName}
              aria-label={t.checklist.customCategoryName}
              value={customCategory}
              maxLength={60}
              onChange={(e) => setCustomCategory(e.target.value)}
              aria-invalid={Boolean(errors.category)}
            />
          )}
          {errors.category && <p className="field-error">{errorText(errors.category)}</p>}
        </div>
        <div>
          <label htmlFor="item-title" className="field-label">
            {t.checklist.itemTitle}
          </label>
          <input
            ref={titleRef}
            id="item-title"
            className="field-input"
            value={title}
            maxLength={200}
            placeholder={t.checklist.itemTitlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(errors.title)}
            autoFocus
          />
          {errors.title && <p className="field-error">{errorText(errors.title)}</p>}
        </div>
      </div>
      {errors._ && <p className="field-error">{errorText(errors._)}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {t.app.cancel}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {t.workspace.add}
        </Button>
      </div>
    </form>
  );
}
