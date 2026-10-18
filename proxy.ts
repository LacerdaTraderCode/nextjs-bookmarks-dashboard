import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

const GUEST_ONLY_PATHS = new Set(["/login", "/register"]);

// Optimistic redirect only: it checks that a cookie exists, never that the token is valid.
// Real authorization happens in each Server Function and data read, and in the API itself.
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  const isGuestPage = GUEST_ONLY_PATHS.has(request.nextUrl.pathname);

  if (!hasSessionCookie && !isGuestPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSessionCookie && isGuestPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
