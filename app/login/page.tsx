import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loginAction } from "@/actions/auth-actions";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

async function ExpiredSessionNotice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reason } = await searchParams;
  if (reason !== "expired") return null;
  return (
    <p role="status" className="notice">
      Your session expired. Sign in again to continue.
    </p>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="auth-layout">
      <section className="panel stack">
        <h1>Sign in</h1>
        <Suspense fallback={null}>
          <ExpiredSessionNotice searchParams={searchParams} />
        </Suspense>
        <AuthForm mode="login" action={loginAction} />
        <p className="muted">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
