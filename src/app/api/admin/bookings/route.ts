import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  handleApiError,
  json,
  optionsResponse,
  requireAdmin,
} from "@/lib/auth";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await adminDb()
      .collection("bookings")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const tripIds = [...new Set(snap.docs.map((d) => d.data().tripId as string))];
    const tripMap = new Map<string, Record<string, unknown>>();
    await Promise.all(
      tripIds.map(async (id) => {
        const t = await adminDb().collection("trips").doc(id).get();
        if (t.exists) tripMap.set(id, t.data() as Record<string, unknown>);
      })
    );

    const bookings = snap.docs.map((d) => {
      const data = d.data();
      const trip = tripMap.get(data.tripId);
      return {
        id: d.id,
        uid: data.uid,
        email: data.email ?? null,
        tripId: data.tripId,
        seatLabels: data.seatLabels,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        departureAt: (() => {
          const d = trip?.departureAt as { toDate?: () => Date } | undefined;
          return d?.toDate?.()?.toISOString?.() ?? null;
        })(),
        from: (trip?.from as string) ?? null,
        to: (trip?.to as string) ?? null,
      };
    });

    return json({ bookings });
  } catch (err) {
    return handleApiError(err);
  }
}
