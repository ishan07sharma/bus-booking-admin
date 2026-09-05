"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Trip = {
  id: string;
  from: string;
  to: string;
  departureAt: string;
  totalSeats: number;
  availableSeats: number;
  status: string;
};

type Scope = "upcoming" | "past";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function todayDateValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const { apiFetch, user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("17:00");
  const [totalSeats, setTotalSeats] = useState("40");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch(`/api/trips?scope=${scope}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load trips");
      setTrips(data.trips || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, scope]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!depDate || !depTime) {
      setError("Pick both a date and a time");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const local = new Date(`${depDate}T${depTime}:00`);
      if (Number.isNaN(local.getTime())) {
        throw new Error("Invalid date or time");
      }
      const res = await apiFetch("/api/admin/trips", {
        method: "POST",
        body: JSON.stringify({
          departureAt: local.toISOString(),
          totalSeats: Number(totalSeats),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setInfo("Trip created.");
      setDepDate("");
      setDepTime("17:00");
      if (scope !== "upcoming") {
        setScope("upcoming");
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this trip? Only allowed if it has no bookings.")) return;
    setError("");
    setInfo("");
    try {
      const res = await apiFetch(`/api/admin/trips/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setInfo("Trip deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <section className="panel" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Add trip</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
          Route is fixed: College → City. Seats are numbered 1…N.
        </p>
        <form onSubmit={onCreate} style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}>
          <div className="datetime-row">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="dep-date">Date</label>
              <input
                id="dep-date"
                className="input-date"
                type="date"
                min={todayDateValue()}
                value={depDate}
                onChange={(e) => setDepDate(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="dep-time">Time</label>
              <input
                id="dep-time"
                className="input-time"
                type="time"
                value={depTime}
                onChange={(e) => setDepTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="seats">Number of seats</label>
            <input
              id="seats"
              type="number"
              min={1}
              max={200}
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Create trip
          </button>
        </form>
      </section>

      {error ? <p className="err">{error}</p> : null}
      {info ? <p className="muted">{info}</p> : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: "1rem", margin: 0 }}>
          {scope === "upcoming" ? "Upcoming trips" : "Past trips"}
        </h2>
        <button
          className="btn"
          type="button"
          onClick={() => setScope(scope === "upcoming" ? "past" : "upcoming")}
        >
          {scope === "upcoming" ? "View past trips" : "View upcoming trips"}
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading trips…</p>
      ) : trips.length === 0 ? (
        <p className="muted">
          {scope === "upcoming" ? "No upcoming trips." : "No past trips."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Route</th>
                <th>Seats</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td>{formatWhen(t.departureAt)}</td>
                  <td>
                    {t.from} → {t.to}
                  </td>
                  <td>
                    {t.availableSeats} free / {t.totalSeats}
                  </td>
                  <td>
                    {scope === "upcoming" ? (
                      <button className="btn btn-danger" type="button" onClick={() => onDelete(t.id)}>
                        Delete
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.85rem" }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
