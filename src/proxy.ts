import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, type JWTPayload } from "jose";

const SESSION_COOKIE_NAME = "fs_session";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/incidents", "/field", "/assets", "/settings"];

// Routes reserved strictly for ADMIN
const ADMIN_ONLY_PREFIXES = ["/dashboard/admin", "/settings/organization"];

// Routes reserved for SUPERVISOR or ADMIN
const SUPERVISOR_PREFIXES = ["/dashboard/triage", "/dashboard/analytics"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // 1. Verify session token if present
  let sessionPayload: JWTPayload | null = null;
  if (sessionCookie) {
    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || "fieldsignal-super-secret-jwt-key-min-32-chars-long"
      );
      const { payload } = await jwtVerify(sessionCookie, secret, {
        algorithms: ["HS256"],
      });
      sessionPayload = payload;
    } catch {
      sessionPayload = null;
    }
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isLoginPage = pathname === "/login";

  // 2. Unauthenticated user accessing a protected route -> Redirect to /login
  if (isProtectedRoute && !sessionPayload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated user accessing /login -> Redirect to dashboard or field view
  if (isLoginPage && sessionPayload) {
    if (sessionPayload.role === "TECHNICIAN") {
      return NextResponse.redirect(new URL("/field", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 4. Role-based Route Protection
  if (sessionPayload) {
    const userRole = sessionPayload.role as string;

    // Check Admin-only routes
    if (ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized_admin", request.url));
    }

    // Check Supervisor-only routes
    if (
      SUPERVISOR_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
      userRole === "TECHNICIAN"
    ) {
      return NextResponse.redirect(
        new URL("/dashboard?error=unauthorized_supervisor", request.url)
      );
    }
  }

  return NextResponse.next();
}

// Support backwards compatibility
export const middleware = proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (handled independently by route guards)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
