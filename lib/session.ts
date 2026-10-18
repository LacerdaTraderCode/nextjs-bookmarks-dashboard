import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiRequestError } from "@/lib/api-client";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { secondsUntilExpiry } from "@/lib/token-expiry";

export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function startSession(accessToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: secondsUntilExpiry(accessToken),
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Every Server Function and data read calls this itself; the proxy only redirects optimistically.
export async function requireSessionToken(): Promise<string> {
  const token = await readSessionToken();
  if (!token) redirect("/login");
  return token;
}

// A rejected token must clear the cookie first, otherwise the proxy would bounce /login back to /dashboard.
export function redirectWhenSessionRejected(error: unknown): void {
  if (error instanceof ApiRequestError && error.status === 401) redirect("/session/expired");
}
