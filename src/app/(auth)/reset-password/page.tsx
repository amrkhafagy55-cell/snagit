import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "../auth-forms";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Set a new password" };

// Reached from the recovery e-mail via /auth/callback, which signs the user in first.
export default async function ResetPasswordPage() {
  const user = await getUser();
  if (!user) redirect("/forgot-password");
  const { t } = await getI18n();
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-navy-950">{t.auth.resetTitle}</h1>
      <UpdatePasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/dashboard" className="font-semibold text-accent-600">
          {t.nav.dashboard}
        </Link>
      </p>
    </div>
  );
}
