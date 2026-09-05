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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const db = adminDb();
    const tripRef = db.collection("trips").doc(id);
    const trip = await tripRef.get();
    if (!trip.exists) return json({ error: "Trip not found" }, 404);

    const bookings = await db
      .collection("bookings")
      .where("tripId", "==", id)
      .limit(1)
      .get();

    if (!bookings.empty) {
      return json(
        { error: "Cannot delete trip that already has bookings" },
        400
      );
    }

    const seats = await tripRef.collection("seats").get();
    const batch = db.batch();
    seats.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(tripRef);
    await batch.commit();

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
