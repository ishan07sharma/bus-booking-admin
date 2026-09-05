import { NextRequest } from "next/server";
import {
  handleApiError,
  json,
  optionsResponse,
  requireAdmin,
} from "@/lib/auth";

export function OPTIONS() {
  return optionsResponse();
}

/** Admin session check for the dashboard. Non-admins get a clear 403. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    return json({
      uid: user.uid,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
