"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user || isAdmin === false) {
      router.replace("/login");
    }
  }, [loading, user, isAdmin, router]);

  if (loading || isAdmin === null) {
    return (
      <main style={{ padding: "2rem" }}>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main style={{ padding: "2rem" }}>
        <p className="muted">Redirecting…</p>
      </main>
    );
  }

  const linkStyle = (href: string) => ({
    padding: "0.35rem 0",
    marginRight: "1.1rem",
    borderBottom: path === href ? "2px solid var(--accent)" : "2px solid transparent",
    color: path === href ? "var(--fg)" : "var(--muted)",
    textDecoration: "none" as const,
    fontWeight: path === href ? 600 : 400,
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.25rem 1rem 3rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 650, fontSize: "1.1rem" }}>Bus booking admin</div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {user.email}
          </div>
        </div>
        <button className="btn" type="button" onClick={() => logout().then(() => router.push("/login"))}>
          Sign out
        </button>
      </header>

      <nav style={{ marginBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" style={linkStyle("/dashboard")}>
          Trips
        </Link>
        <Link href="/dashboard/bookings" style={linkStyle("/dashboard/bookings")}>
          Bookings
        </Link>
      </nav>

      {children}
    </div>
  );
}
