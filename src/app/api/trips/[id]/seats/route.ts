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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(req);
    const { id } = await params;
    const tripRef = adminDb().collection("trips").doc(id);
    const trip = await tripRef.get();
    if (!trip.exists) return json({ error: "Trip not found" }, 404);

    const seatsSnap = await tripRef.collection("seats").orderBy("order").get();
    const seats = seatsSnap.docs.map((d) => ({
      id: d.id,
      label: d.data().label as string,
      status: d.data().status as string,
    }));

    return json({ tripId: id, seats });
  } catch (err) {
    return handleApiError(err);
  }
}
