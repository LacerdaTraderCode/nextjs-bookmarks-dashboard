import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

// Reached when the API rejects the stored token. Deleting the cookie here is what stops the proxy
// from redirecting /login straight back to /dashboard in a loop.
export function GET(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "?reason=expired";

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
