import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getProfile, requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { UpdatePasswordForm } from "../../(auth)/auth-forms";
import { ProfileForm } from "./profile-form";
import { LinkButton } from "@/components/ui";
import { getEntitlements } from "@/lib/billing";
import { formatDate } from "@/lib/i18n";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [user, profile, { t, lang }, ent] = await Promise.all([requireUser(), getProfile(), getI18n(), getEntitlements()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t.settings.title} />
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">{t.settings.profile}</h2>
        <p className="mb-5 text-sm text-navy-500">{t.settings.profileHint}</p>
        <ProfileForm
          email={user.email}
          isAdmin={profile?.role === "admin"}
          initial={{
            fullName: profile?.full_name ?? "",
            phone: profile?.phone ?? "",
            company: profile?.company ?? "",
            accountType: profile?.role === "inspector" ? "inspector" : "individual",
          }}
        />
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="mb-5 text-lg font-semibold text-navy-900">{t.settings.security}</h2>
        <UpdatePasswordForm title={t.settings.changePassword} />
      </section>
      <section className="card flex items-center justify-between p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-navy-900">{t.settings.plan}</h2>
          <p className="text-sm text-navy-500">
            {ent.pro ? t.billing.pro : t.billing.free}
            {ent.pro && ent.proUntil ? ` · ${t.billing.proUntil} ${formatDate(ent.proUntil, lang)}` : ""}
          </p>
        </div>
        <LinkButton href="/billing" variant={ent.pro ? "secondary" : "accent"} size="sm">
          {ent.pro ? t.billing.nav : t.billing.upgrade}
        </LinkButton>
      </section>
    </div>
  );
}
