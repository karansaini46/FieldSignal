import { clearSessionCookie } from "@/lib/session";
import { apiSuccess } from "@/lib/api-response";

export async function POST() {
  const response = apiSuccess({
    message: "Logged out successfully.",
  });

  clearSessionCookie(response);
  return response;
}
