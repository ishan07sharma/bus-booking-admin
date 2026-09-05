/** Max seats a student may hold across trips that have not departed yet. */
export const ACTIVE_SEAT_CAP = 4;

type TripLike = {
  status?: string;
  departureAt?: { toDate?: () => Date } | Date | null;
};

export function departureDate(trip: TripLike): Date | null {
  const raw = trip.departureAt;
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw.toDate === "function") return raw.toDate();
  return null;
}

/** Scheduled trip whose departure is still in the future. */
export function tripIsActive(trip: TripLike, now = new Date()): boolean {
  if (trip.status !== "scheduled") return false;
  const dep = departureDate(trip);
  if (!dep) return false;
  return dep.getTime() > now.getTime();
}
