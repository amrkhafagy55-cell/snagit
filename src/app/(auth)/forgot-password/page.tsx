import type { Metadata } from "next";
import { ForgotForm } from "../auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
