import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  handleApiError,
  json,
  optionsResponse,
  requireUser,
} from "@/lib/auth";
import { ACTIVE_SEAT_CAP, tripIsActive } from "@/lib/active-seats";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    // if (user.role === "admin") {
    //   return json({ error: "Admins cannot book seats" }, 403);
    // }

    const body = await req.json();
    const tripId = body.tripId as string;
    let seatIds = body.seatIds as string[];

    if (!tripId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return json({ error: "tripId and seatIds required" }, 400);
    }

    seatIds = [...new Set(seatIds)].sort();

    const db = adminDb();
    const userRef = db.collection("users").doc(user.uid);
    const tripRef = db.collection("trips").doc(tripId);
    const bookingRef = db.collection("bookings").doc();

    const result = await db.runTransaction(async (tx) => {
      const now = new Date();

      // --- all reads first ---
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new BookError("Trip not found", 404);
      const trip = tripSnap.data()!;
      if (!tripIsActive(trip, now)) {
        throw new BookError("Trip is not available for booking", 400);
      }

      await tx.get(userRef);

      const existingBookings = await tx.get(
        db.collection("bookings").where("uid", "==", user.uid)
      );

      const otherTripIds = [
        ...new Set(
          existingBookings.docs
            .map((d) => d.data().tripId as string)
            .filter((id) => id !== tripId)
        ),
      ];

      const otherTripSnaps = await Promise.all(
        otherTripIds.map((id) => tx.get(db.collection("trips").doc(id)))
      );
      const activeByTrip = new Map<string, boolean>();
      activeByTrip.set(tripId, true); // current trip already validated
      for (let i = 0; i < otherTripIds.length; i++) {
        const s = otherTripSnaps[i]!;
        activeByTrip.set(
          otherTripIds[i]!,
          s.exists ? tripIsActive(s.data()!, now) : false
        );
      }

      let activeSeats = 0;
      for (const d of existingBookings.docs) {
        const data = d.data();
        if (activeByTrip.get(data.tripId as string)) {
          activeSeats += Array.isArray(data.seatIds) ? data.seatIds.length : 0;
        }
      }

      if (activeSeats + seatIds.length > ACTIVE_SEAT_CAP) {
        throw new BookError(
          `Limit is ${ACTIVE_SEAT_CAP} seats on upcoming trips (you have ${activeSeats} active)`,
          400
        );
      }

      const seatRefs = seatIds.map((id) => tripRef.collection("seats").doc(id));
      const seatSnaps = await Promise.all(seatRefs.map((r) => tx.get(r)));
      const labels: string[] = [];

      for (let i = 0; i < seatSnaps.length; i++) {
        const snap = seatSnaps[i]!;
        if (!snap.exists) throw new BookError(`Seat not found: ${seatIds[i]}`, 404);
        const seat = snap.data()!;
        if (seat.status !== "available") {
          throw new BookError(`Seat already taken: ${seat.label}`, 409);
        }
        labels.push(seat.label as string);
      }

      // --- writes ---
      for (let i = 0; i < seatRefs.length; i++) {
        tx.update(seatRefs[i]!, {
          status: "booked",
          bookingId: bookingRef.id,
        });
      }

      tx.set(bookingRef, {
        uid: user.uid,
        email: user.email,
        tripId,
        seatIds,
        seatLabels: labels,
        createdAt: FieldValue.serverTimestamp(),
      });

      // cache = active seats after this booking
      tx.set(
        userRef,
        { seatsBookedCount: activeSeats + seatIds.length },
        { merge: true }
      );

      return {
        bookingId: bookingRef.id,
        tripId,
        seatIds,
        seatLabels: labels,
        activeSeats: activeSeats + seatIds.length,
        maxSeats: ACTIVE_SEAT_CAP,
      };
    });

    return json({ booking: result }, 201);
  } catch (err) {
    if (err instanceof BookError) return json({ error: err.message }, err.status);
    return handleApiError(err);
  }
}

class BookError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
