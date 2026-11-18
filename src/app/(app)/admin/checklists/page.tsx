import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { categoryLabel, fill, formatNumber } from "@/lib/i18n";
import { getCategoryLabels, getDefectCategories } from "@/lib/categories";
import { Alert } from "@/components/ui";
import { SectionTitle, first } from "@/components/admin/admin-ui";
import { ROOM_TYPES, type RoomType } from "@/lib/types";
import { NewTemplate, TemplateItem, type TemplateRow } from "./template-editor";

export default async function AdminChecklistsPage({ searchParams }: PageProps<"/admin/checklists">) {
  const sp = await searchParams;
  const room = ((ROOM_TYPES as readonly string[]).includes(first(sp.room)) ? first(sp.room) : "entrance") as RoomType;
  const [{ t, lang }, supabase, cats] = await Promise.all([getI18n(), createClient(), getDefectCategories()]);
  const labels = await getCategoryLabels(lang);
  const [{ data, error }, { data: counts }] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select("id, room_type, category, title_en, title_ar, sort_order, is_active")
      .eq("room_type", room)
      .order("sort_order")
      .order("title_en"),
    supabase.from("checklist_templates").select("room_type").eq("is_active", true),
  ]);
  const rows = (data ?? []) as TemplateRow[];
  const perRoom = new Map<string, number>();
  for (const r of counts ?? []) perRoom.set(r.room_type as string, (perRoom.get(r.room_type as string) ?? 0) + 1);
  const options = cats.filter((c) => c.is_active).map((c) => ({ key: c.key, label: lang === "ar" ? c.name_ar : c.name_en }));
  const nextOrder = (rows.reduce((m, r) => Math.max(m, r.sort_order), 0) || 0) + 10;

  return (
    <>
      <SectionTitle hint={t.admin.checklistsHint}>{t.admin.tabs.checklists}</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t.admin.roomType}>
        {ROOM_TYPES.map((r) => (
          <Link
            key={r}
            href={`/admin/checklists?room=${r}`}
            aria-current={room === r ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${room === r ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"}`}
          >
            {t.rooms[r]}
            <span className={`ms-1.5 text-xs ${room === r ? "text-navy-200" : "text-navy-400"}`}>{formatNumber(perRoom.get(r) ?? 0, lang)}</span>
          </Link>
        ))}
      </div>
      {error ? (
        <Alert>{t.errors.pageError}</Alert>
      ) : (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <p className="border-b border-navy-100 bg-navy-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
              {t.rooms[room]} · {fill(t.admin.itemCount, { n: formatNumber(rows.length, lang) })}
            </p>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-navy-500">{t.admin.noResults}</p>
            ) : (
              <ul className="divide-y divide-navy-100">
                {rows.map((row) => (
                  <TemplateItem key={row.id} row={row} categories={options} categoryLabel={categoryLabel(row.category, t, labels)} />
                ))}
              </ul>
            )}
          </div>
          <NewTemplate key={room} roomType={room} categories={options} nextOrder={nextOrder} />
        </div>
      )}
    </>
  );
}
