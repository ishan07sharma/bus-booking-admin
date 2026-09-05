import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  handleApiError,
  json,
  optionsResponse,
  requireUser,
} from "@/lib/auth";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const scope = (req.nextUrl.searchParams.get("scope") || "upcoming").toLowerCase();
    const past = scope === "past";
    const now = Date.now();

    const snap = await adminDb()
      .collection("trips")
      .where("status", "==", "scheduled")
      .get();

    const trips = (
      await Promise.all(
        snap.docs.map(async (doc) => {
          const data = doc.data();
          const depDate: Date | null = data.departureAt?.toDate?.() ?? null;
          const departureMs = depDate?.getTime() ?? 0;
          const isPast = departureMs <= now;
          if (past !== isPast) return null;

          const seats = await doc.ref.collection("seats").get();
          const available = seats.docs.filter(
            (s) => s.data().status === "available"
          ).length;

          return {
            id: doc.id,
            from: data.from,
            to: data.to,
            departureAt: depDate?.toISOString() ?? null,
            totalSeats: data.totalSeats,
            availableSeats: available,
            status: data.status,
            past: isPast,
          };
        })
      )
    ).filter(Boolean) as Array<{
      id: string;
      from: string;
      to: string;
      departureAt: string | null;
      totalSeats: number;
      availableSeats: number;
      status: string;
      past: boolean;
    }>;

    trips.sort((a, b) => {
      const cmp = String(a.departureAt ?? "").localeCompare(String(b.departureAt ?? ""));
      return past ? -cmp : cmp;
    });

    return json({ trips, scope: past ? "past" : "upcoming" });
  } catch (err) {
    return handleApiError(err);
  }
}
