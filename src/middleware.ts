import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "pos_session";
const PUBLIC_PATHS = ["/login", "/register", "/api/webhooks"];

/**
 * This middleware only checks for the PRESENCE of a session cookie so we
 * can redirect anonymous traffic away from the dashboard cheaply at the
 * edge. It does NOT validate the session or load permissions — that
 * happens in `requireAuthContext()` inside the dashboard layout and every
 * server action, which is the actual security boundary. Never treat a
 * middleware pass as authorization.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && pathname.startsWith("/dashboard") && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
