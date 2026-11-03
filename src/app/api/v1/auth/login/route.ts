import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { handleApiError, UnauthorizedError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";

const loginSchema = z.object({
  identifier: z.string().min(3, "Identifier must be a valid phone number or email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = loginSchema.parse(body);

    // Look up user by phone or email
    const user = await db.user.findFirst({
      where: {
        OR: [{ phone: identifier }, { email: identifier }],
      },
      include: {
        organization: true,
        site: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid credentials or account is inactive.");
    }

    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials or account is inactive.");
    }

    const sessionPayload = {
      userId: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      siteId: user.siteId,
    };

    const token = await createSessionToken(sessionPayload);

    // Prepare success response and attach HttpOnly cookie
    const response = apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          code: user.organization.code,
        },
        site: user.site
          ? {
              id: user.site.id,
              name: user.site.name,
              code: user.site.code,
              capacityMw: Number(user.site.capacityMw),
            }
          : null,
      },
      token,
    });

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
