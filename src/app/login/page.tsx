"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { user, loading, isAdmin, signInEmail, signInGoogle, requireAdminSession, logout } =
    useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin === true) router.replace("/dashboard");
    if (user && isAdmin === false) {
      setError("Only admins can sign in to this dashboard");
    }
  }, [loading, user, isAdmin, router]);

  async function afterSignIn() {
    await requireAdminSession();
    router.replace("/dashboard");
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInEmail(email.trim(), password);
      await afterSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      await logout().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInGoogle();
      await afterSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed");
      await logout().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "3rem 1.25rem" }}>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 380,
        margin: "4rem auto",
        padding: "0 1rem",
      }}
    >
      <h1 style={{ fontSize: "1.35rem", fontWeight: 650, marginBottom: "0.25rem" }}>
        Bus booking admin
      </h1>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Sign in with an admin account listed in ADMIN_EMAILS.
      </p>

      <form onSubmit={onEmail} className="panel">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          Sign in
        </button>
      </form>

      <div style={{ marginTop: "0.85rem" }}>
        <button className="btn" type="button" onClick={onGoogle} disabled={busy} style={{ width: "100%" }}>
          Continue with Google
        </button>
      </div>
    </main>
  );
}
