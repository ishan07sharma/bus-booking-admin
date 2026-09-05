"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Booking = {
  id: string;
  email: string | null;
  seatLabels: string[];
  createdAt: string | null;
  departureAt: string | null;
  from: string | null;
  to: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BookingsPage() {
  const { apiFetch, user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await apiFetch("/api/admin/bookings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bookings");
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Bookings</h2>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
        >
          Refresh
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="muted">No bookings yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Trip</th>
                <th>Seats</th>
                <th>Booked at</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.email || "—"}</td>
                  <td>
                    <div>
                      {b.from} → {b.to}
                    </div>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {fmt(b.departureAt)}
                    </div>
                  </td>
                  <td>{(b.seatLabels || []).join(", ")}</td>
                  <td>{fmt(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
