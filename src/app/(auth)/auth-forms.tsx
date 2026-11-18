"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import {
  forgotPasswordAction,
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  updatePasswordAction,
  type AuthState,
} from "./actions";

function Submit({ label, pending }: { label: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
      {isPending ? pending : label}
    </Button>
  );
}

function PasswordInput({ id, name, autoComplete, error }: { id: string; name: string; autoComplete: string; error?: string }) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        className="field-input pe-11"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        dir="ltr"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 end-0 grid w-11 place-items-center text-navy-400 hover:text-navy-700"
        aria-label={t.auth.password}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function GoogleButton({ next }: { next?: string }) {
  const { t } = useI18n();
  return (
    <form action={signInWithGoogleAction}>
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <GoogleSubmit label={t.auth.withGoogle} />
    </form>
  );
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="lg" className="w-full" loading={pending}>
      {!pending && (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2.1H12v4h6c-.1 1-.8 2.6-2.3 3.6v3h3.7c2.1-2 3.2-4.9 3.2-8.5Z" />
          <path fill="#34A853" d="M12 23c3 0 5.6-1 7.4-2.7l-3.7-2.9c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2v3C3.8 20.6 7.6 23 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.3-.4-2s.1-1.4.3-2V7H2c-.7 1.5-1.2 3.2-1.2 5s.4 3.5 1.2 5l3.8-3Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 2.8.7 3.4 1.3l2.6-2.5C16.4 2.7 14.4 1.8 12 1.8 7.6 1.8 3.8 4.3 2 8l3.8 3c.9-2.6 3.3-4.6 6.2-4.6Z" />
        </svg>
      )}
      {label}
    </Button>
  );
}

function Divider() {
  const { t } = useI18n();
  return (
    <div className="my-5 flex items-center gap-3 text-sm text-navy-400">
      <span className="h-px flex-1 bg-navy-100" />
      {t.auth.or}
      <span className="h-px flex-1 bg-navy-100" />
    </div>
  );
}

function useFormText(state: AuthState) {
  const err = useErrorText();
  return {
    error: state?.error ? err(state.error) : "",
    field: (name: string) => (state?.fieldErrors?.[name] ? err(state.fieldErrors[name]) : undefined),
  };
}

export function LoginForm({ next, initialError, googleEnabled }: { next?: string; initialError?: string; googleEnabled: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(signInAction, null);
  const { error, field } = useFormText(state);
  const shownError = error || (initialError === "callback" ? t.auth.callbackError : initialError === "google" ? t.errors.googleDisabled : "");
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-navy-950">{t.auth.loginTitle}</h1>
      <p className="mt-1 text-navy-500">{t.auth.loginSubtitle}</p>
      {googleEnabled && (
        <>
          <div className="mt-6">
            <GoogleButton next={next} />
          </div>
          <Divider />
        </>
      )}
      <form action={action} className={`space-y-4 ${googleEnabled ? "" : "mt-6"}`} noValidate>
        {shownError && <Alert>{shownError}</Alert>}
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <Field label={t.auth.email} htmlFor="email" error={field("email")}>
          <input id="email" name="email" type="email" autoComplete="email" className="field-input" dir="ltr" required aria-invalid={Boolean(field("email"))} defaultValue={state?.values?.email} />
        </Field>
        <Field label={t.auth.password} htmlFor="password" error={field("password")}>
          <PasswordInput id="password" name="password" autoComplete="current-password" error={field("password")} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-navy-600 hover:text-accent-600">
            {t.auth.forgot}
          </Link>
        </div>
        <Submit label={t.auth.signIn} pending={t.auth.signingIn} />
      </form>
      <p className="mt-6 text-center text-sm text-navy-500">
        {t.auth.noAccount}{" "}
        <Link href="/register" className="font-semibold text-accent-600 hover:text-accent-700">
          {t.nav.getStarted}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(signUpAction, null);
  const { error, field } = useFormText(state);
  if (state?.message === "checkEmail") {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-bold text-navy-950">{t.auth.registerTitle}</h1>
        <div className="mt-4">
          <Alert tone="success">{t.auth.checkEmail}</Alert>
        </div>
        <Link href="/login" className="mt-6 inline-block font-semibold text-accent-600">
          {t.auth.signIn}
        </Link>
      </div>
    );
  }
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-navy-950">{t.auth.registerTitle}</h1>
      <p className="mt-1 text-navy-500">{t.auth.registerSubtitle}</p>
      {googleEnabled && (
        <>
          <div className="mt-6">
            <GoogleButton />
          </div>
          <Divider />
        </>
      )}
      <form action={action} className={`space-y-4 ${googleEnabled ? "" : "mt-6"}`} noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t.auth.fullName} htmlFor="fullName" error={field("fullName")}>
          <input id="fullName" name="fullName" autoComplete="name" className="field-input" required aria-invalid={Boolean(field("fullName"))} defaultValue={state?.values?.fullName} />
        </Field>
        <Field label={t.auth.email} htmlFor="email" error={field("email")}>
          <input id="email" name="email" type="email" autoComplete="email" className="field-input" dir="ltr" required aria-invalid={Boolean(field("email"))} defaultValue={state?.values?.email} />
        </Field>
        <Field label={t.auth.password} htmlFor="password" error={field("password")} hint={t.auth.passwordHint}>
          <PasswordInput id="password" name="password" autoComplete="new-password" error={field("password")} />
        </Field>
        <fieldset>
          <legend className="field-label">{t.auth.accountType}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["individual", "inspector"] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-200 p-3 text-sm has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50">
                <input type="radio" name="accountType" value={v} defaultChecked={v === (state?.values?.accountType ?? "individual")} className="accent-navy-800" />
                {t.auth[v]}
              </label>
            ))}
          </div>
        </fieldset>
        <Submit label={t.auth.signUp} pending={t.auth.signingUp} />
        <p className="text-xs text-navy-400">
          {t.auth.terms}{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-navy-600 underline">
            {t.legal.terms}
          </Link>
          {" · "}
          <Link href="/privacy" target="_blank" className="font-semibold text-navy-600 underline">
            {t.legal.privacy}
          </Link>
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-navy-500">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-accent-600 hover:text-accent-700">
          {t.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(forgotPasswordAction, null);
  const { error, field } = useFormText(state);
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-navy-950">{t.auth.forgotTitle}</h1>
      <p className="mt-1 text-navy-500">{t.auth.forgotSubtitle}</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        {state?.message === "linkSent" && <Alert tone="success">{t.auth.linkSent}</Alert>}
        <Field label={t.auth.email} htmlFor="email" error={field("email")}>
          <input id="email" name="email" type="email" autoComplete="email" className="field-input" dir="ltr" required aria-invalid={Boolean(field("email"))} defaultValue={state?.values?.email} />
        </Field>
        <Submit label={t.auth.sendLink} pending={t.auth.sending} />
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-accent-600">
          {t.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

export function UpdatePasswordForm({ title }: { title?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(updatePasswordAction, null);
  const { error, field } = useFormText(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      {title && <h2 className="text-lg font-semibold text-navy-900">{title}</h2>}
      {error && <Alert>{error}</Alert>}
      {state?.message === "passwordUpdated" && <Alert tone="success">{t.auth.passwordUpdated}</Alert>}
      <Field label={t.auth.newPassword} htmlFor="new-password" error={field("password")} hint={t.auth.passwordHint}>
        <PasswordInput id="new-password" name="password" autoComplete="new-password" error={field("password")} />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirm-password" error={field("confirm")}>
        <PasswordInput id="confirm-password" name="confirm" autoComplete="new-password" error={field("confirm")} />
      </Field>
      <Submit label={t.auth.updatePassword} pending={t.app.saving} />
    </form>
  );
}
