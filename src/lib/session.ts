import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AuthSession } from "@/modules/auth/permissions";

export const SESSION_COOKIE_NAME = "fs_session";
const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);
const TOKEN_EXPIRY = "7d";

/**
 * Creates a signed JWT token representing the authenticated user session.
 */
export async function createSessionToken(session: AuthSession): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    name: session.name,
    phone: session.phone,
    email: session.email ?? null,
    role: session.role,
    organizationId: session.organizationId,
    siteId: session.siteId ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET_KEY);
}

/**
 * Verifies a JWT session token and returns the parsed session payload.
 * Returns null if token is invalid, expired, or tampered with.
 */
export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ["HS256"],
    });

    if (
      !payload.userId ||
      !payload.role ||
      !payload.organizationId ||
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.organizationId !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      name: (payload.name as string) ?? "",
      phone: (payload.phone as string) ?? "",
      email: (payload.email as string) ?? null,
      role: payload.role as AuthSession["role"],
      organizationId: payload.organizationId,
      siteId: (payload.siteId as string) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Attaches the session cookie to an outgoing HTTP NextResponse.
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  });
}

/**
 * Clears the session cookie on an outgoing HTTP NextResponse (Logout).
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Reads and verifies the current session from incoming Next.js request cookies.
 * Works inside Server Components and Route Handlers.
 */
export async function getSessionFromCookies(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
