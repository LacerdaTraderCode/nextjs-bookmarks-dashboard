import type { Metadata } from "next";
import Link from "next/link";

import { registerAction } from "@/actions/auth-actions";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <main className="auth-layout">
      <section className="panel stack">
        <h1>Create account</h1>
        <AuthForm mode="register" action={registerAction} />
        <p className="muted">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
