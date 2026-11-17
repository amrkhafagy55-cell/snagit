import type { Metadata } from "next";
import { getEnabledProviders } from "@/lib/supabase/providers";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const { google } = await getEnabledProviders();
  return <RegisterForm googleEnabled={google} />;
}
