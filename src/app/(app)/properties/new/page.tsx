import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getProfile, requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { PropertyWizard } from "./wizard";

export const metadata: Metadata = { title: "New inspection" };

export default async function NewPropertyPage() {
  const [user, profile, { t }] = await Promise.all([requireUser(), getProfile(), getI18n()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.property.newTitle} subtitle={t.property.newSubtitle} />
      <PropertyWizard
        userId={user.id}
        defaultInspector={profile?.role === "inspector" ? profile.full_name : ""}
        defaultOwner={profile?.role === "individual" ? profile.full_name : ""}
      />
    </div>
  );
}
