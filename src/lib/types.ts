export type SeatStatus = "available" | "booked";
export type TripStatus = "scheduled" | "cancelled";

export type UserDoc = {
  email: string;
  role: "student" | "admin";
  seatsBookedCount: number;
  createdAt: unknown;
};

export type TripDoc = {
  from: string;
  to: string;
  departureAt: unknown;
  totalSeats: number;
  status: TripStatus;
  createdAt: unknown;
};

export type SeatDoc = {
  label: string;
  status: SeatStatus;
  bookingId: string | null;
};

export type BookingDoc = {
  uid: string;
  tripId: string;
  seatIds: string[];
  seatLabels: string[];
  createdAt: unknown;
};

