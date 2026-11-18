import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { getProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Non-admins get a plain 404, so the admin area isn't advertised. The database enforces the same
// rule on every admin read and write (RLS admin policies and assert_admin()).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [profile, { t }] = await Promise.all([getProfile(), getI18n()]);
  if (profile?.role !== "admin") notFound();
  return (
    <>
      <PageHeader title={t.admin.title} subtitle={t.admin.subtitle} />
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
