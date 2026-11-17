import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { InspectionStatusBadge } from "@/components/badges";
import { getInspection } from "@/lib/data";
import { formatDate } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { InspectionTabs } from "./_components/tabs";

export async function generateMetadata({ params }: LayoutProps<"/inspections/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { property } = await getInspection(id);
  return { title: { default: property.project_name, template: `%s · ${property.project_name} · SNAGIT` } };
}

export default async function InspectionLayout({ children, params }: LayoutProps<"/inspections/[id]">) {
  const { id } = await params;
  const [{ inspection, property, summary }, { t, lang }] = await Promise.all([getInspection(id), getI18n()]);
  const unit = [
    property.building_number && `${t.property.building} ${property.building_number}`,
    property.apartment_number && `${t.property.apt} ${property.apartment_number}`,
    property.floor_number && `${t.property.floor} ${property.floor_number}`,
  ].filter(Boolean).join(" · ");

  return (
    <div>
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t.nav.dashboard}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">{property.project_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-500">
            <span>{unit || t.propertyTypes[property.property_type]}</span>
            {property.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {property.address}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden />
              {formatDate(inspection.inspection_date, lang)}
            </span>
          </div>
        </div>
        <InspectionStatusBadge status={inspection.status} t={t} />
      </div>
      <InspectionTabs id={id} defectCount={summary.defects_total} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
