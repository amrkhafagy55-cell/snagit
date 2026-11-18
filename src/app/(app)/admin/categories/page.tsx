import { getI18n } from "@/lib/i18n/server";
import { getDefectCategories } from "@/lib/categories";
import { SectionTitle } from "@/components/admin/admin-ui";
import { CategoryItem, NewCategory } from "./category-editor";

export default async function AdminCategoriesPage() {
  const [{ t }, cats] = await Promise.all([getI18n(), getDefectCategories()]);
  const nextOrder = cats.reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
  return (
    <div className="space-y-4">
      <SectionTitle hint={t.admin.categoriesHint}>{t.admin.tabs.categories}</SectionTitle>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/60 text-xs font-semibold uppercase tracking-wide text-navy-500">
              <th scope="col" className="px-4 py-3 text-start">{t.admin.key}</th>
              <th scope="col" className="px-2 py-3 text-start">{t.admin.nameEn}</th>
              <th scope="col" className="px-2 py-3 text-start">{t.admin.nameAr}</th>
              <th scope="col" className="px-2 py-3 text-start">{t.admin.order}</th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {cats.map((c) => (
              <CategoryItem key={`${c.key}-${c.name_en}-${c.name_ar}-${c.sort_order}-${c.is_active}`} row={c} />
            ))}
          </tbody>
        </table>
      </div>
      <NewCategory nextOrder={nextOrder} />
    </div>
  );
}
