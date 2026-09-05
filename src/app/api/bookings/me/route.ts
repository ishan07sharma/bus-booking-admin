import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  handleApiError,
  json,
  optionsResponse,
  requireUser,
} from "@/lib/auth";
import {
  ACTIVE_SEAT_CAP,
  departureDate,
  tripIsActive,
} from "@/lib/active-seats";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const db = adminDb();
    const now = new Date();

    const snap = await db.collection("bookings").where("uid", "==", user.uid).get();

    const tripIds = [...new Set(snap.docs.map((d) => d.data().tripId as string))];
    const tripMap = new Map<string, Record<string, unknown>>();
    await Promise.all(
      tripIds.map(async (id) => {
        const t = await db.collection("trips").doc(id).get();
        if (t.exists) tripMap.set(id, t.data() as Record<string, unknown>);
      })
    );

    let activeSeats = 0;
    const bookings = snap.docs.map((d) => {
      const data = d.data();
      const trip = tripMap.get(data.tripId);
      const active = trip ? tripIsActive(trip, now) : false;
      const seatCount = Array.isArray(data.seatIds) ? data.seatIds.length : 0;
      if (active) activeSeats += seatCount;
      const dep = trip ? departureDate(trip) : null;
      return {
        id: d.id,
        tripId: data.tripId,
        seatIds: data.seatIds,
        seatLabels: data.seatLabels,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        departureAt: dep?.toISOString() ?? null,
        from: (trip?.from as string) ?? null,
        to: (trip?.to as string) ?? null,
        active,
      };
    });

    bookings.sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

    // refresh cache so it stays accurate after trips depart
    await db.collection("users").doc(user.uid).set(
      { seatsBookedCount: activeSeats },
      { merge: true }
    );

    return json({
      bookings,
      activeSeats,
      maxSeats: ACTIVE_SEAT_CAP,
      seatsBookedCount: activeSeats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
