"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { getEnabledProviders } from "@/lib/supabase/providers";
import { getI18n } from "@/lib/i18n/server";

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
} | null;

const email = z.email("invalidEmail");
const password = z.string().min(8, "passwordShort").max(72, "tooLong");

function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

function mapAuthError(code: string | undefined, status?: number): string {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "userExists";
    case "weak_password":
      return "passwordShort";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    case "provider_disabled":
    case "validation_failed":
      return "googleDisabled";
    default:
      return status === 429 ? "rateLimited" : "generic";
  }
}

function fieldErrorsOf(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    out[key] ??= issue.message;
  }
  return out;
}

export async function signInAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "required") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: mapAuthError(error.code, error.status), values };
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(1, "required").max(120, "tooLong"),
      email,
      password,
      accountType: z.enum(["individual", "inspector"]),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      accountType: formData.get("accountType") ?? "individual",
    });
  const values = {
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    accountType: String(formData.get("accountType") ?? "individual"),
  };
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { lang } = await getI18n();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, account_type: parsed.data.accountType, locale: lang },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: mapAuthError(error.code, error.status), values };
  if (data.session) redirect("/dashboard");
  return { message: "checkEmail" };
}

export async function forgotPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: "invalidEmail" } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists (no account enumeration).
  if (error && (error.status === 429 || error.code?.includes("rate_limit"))) return { error: "rateLimited" };
  return { message: "linkSent" };
}

export async function updatePasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "passwordMismatch", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "unauthorized" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: mapAuthError(error.code, error.status) };
  return { message: "passwordUpdated" };
}

export async function signInWithGoogleAction(formData: FormData) {
  if (!(await getEnabledProviders()).google) redirect("/login?error=google");
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
