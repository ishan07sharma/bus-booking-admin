import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { isAdminEmail, isCollegeEmail } from "./config";
import { UserDoc } from "./types";
import { FieldValue } from "firebase-admin/firestore";

export type AuthedUser = {
  uid: string;
  email: string;
  role: "student" | "admin";
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function withCors(res: NextResponse) {
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
}

export function json(data: unknown, status = 200) {
  return withCors(NextResponse.json(data, { status }));
}

export function optionsResponse() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/** Verify Firebase token and resolve role. Does not enforce college domain. */
export async function authenticate(req: NextRequest): Promise<AuthedUser> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthError("Missing Authorization Bearer token", 401);

  const decoded = await adminAuth().verifyIdToken(match[1]!);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new AuthError("Token has no email", 401);

  const role: "student" | "admin" = isAdminEmail(email) ? "admin" : "student";

  const ref = adminDb().collection("users").doc(decoded.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const doc: UserDoc = {
      email,
      role,
      seatsBookedCount: 0,
      createdAt: FieldValue.serverTimestamp() as unknown as Date,
    };
    await ref.set(doc);
  } else {
    const data = snap.data() as UserDoc;
    if (data.role !== role) await ref.update({ role, email });
  }

  return { uid: decoded.uid, email, role };
}

/** Student (or admin) APIs — students must use college email. */
export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const user = await authenticate(req);
  if (user.role === "student" && !isCollegeEmail(user.email)) {
    throw new AuthError(
      `Students must use a @${process.env.COLLEGE_EMAIL_DOMAIN} email`,
      403
    );
  }
  return user;
}

/** Admin dashboard / admin APIs only. */
export async function requireAdmin(req: NextRequest): Promise<AuthedUser> {
  const user = await authenticate(req);
  if (user.role !== "admin") {
    throw new AuthError("Only admins can sign in to this dashboard", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) return json({ error: err.message }, err.status);
  console.error(err);
  const message = err instanceof Error ? err.message : "Server error";
  return json({ error: message }, 500);
}
