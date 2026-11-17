import type { Metadata } from "next";
import { getEnabledProviders } from "@/lib/supabase/providers";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const { google } = await getEnabledProviders();
  return <LoginForm next={next} initialError={error} googleEnabled={google} />;
}
