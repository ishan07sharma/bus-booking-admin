import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  handleApiError,
  json,
  optionsResponse,
  requireAdmin,
} from "@/lib/auth";
import { routeFrom, routeTo } from "@/lib/config";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const departureAt = body.departureAt as string;
    const totalSeats = Number(body.totalSeats);

    if (!departureAt || !Number.isFinite(totalSeats) || totalSeats < 1 || totalSeats > 200) {
      return json({ error: "departureAt and totalSeats (1–200) required" }, 400);
    }

    const dep = new Date(departureAt);
    if (Number.isNaN(dep.getTime())) {
      return json({ error: "Invalid departureAt" }, 400);
    }

    const db = adminDb();
    const tripRef = db.collection("trips").doc();

    const batch = db.batch();
    batch.set(tripRef, {
      from: routeFrom(),
      to: routeTo(),
      departureAt: dep,
      totalSeats,
      status: "scheduled",
      createdAt: FieldValue.serverTimestamp(),
    });

    for (let i = 1; i <= totalSeats; i++) {
      const label = String(i);
      const seatRef = tripRef.collection("seats").doc(label);
      batch.set(seatRef, {
        label,
        order: i,
        status: "available",
        bookingId: null,
      });
    }

    await batch.commit();

    return json(
      {
        trip: {
          id: tripRef.id,
          from: routeFrom(),
          to: routeTo(),
          departureAt: dep.toISOString(),
          totalSeats,
          status: "scheduled",
        },
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}
