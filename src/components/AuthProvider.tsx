"use client";

import { FirebaseError } from "firebase/app";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { clientAuth, googleProvider } from "@/lib/firebase-client";

type AdminProfile = { uid: string; email: string; role: string };

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** null = still checking, true/false after /api/me */
  isAdmin: boolean | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  requireAdminSession: () => Promise<AdminProfile>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/user-disabled":
        return "This account has been disabled";
      case "auth/user-not-found":
        return "No account found for this email. Create it in Firebase Auth, or use Google sign-in.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Wrong email or password";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled";
      default:
        return err.message.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/.*\)\.?$/, "");
    }
  }
  if (err instanceof Error) return err.message;
  return "Login failed";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const adminProfileRef = useRef<AdminProfile | null>(null);
  const verifyInFlight = useRef<Promise<AdminProfile> | null>(null);

  const clearAdmin = useCallback(() => {
    setIsAdmin(null);
    adminProfileRef.current = null;
    verifyInFlight.current = null;
  }, []);

  const verifyAdmin = useCallback(async (u: User): Promise<AdminProfile> => {
    if (adminProfileRef.current?.uid === u.uid) {
      setIsAdmin(true);
      return adminProfileRef.current;
    }
    if (verifyInFlight.current) return verifyInFlight.current;

    const run = (async () => {
      const t = await u.getIdToken();
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      let data: { error?: string; uid?: string; email?: string; role?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: "Invalid response from server" };
      }

      if (!res.ok) {
        setIsAdmin(false);
        adminProfileRef.current = null;
        // Only sign out on auth/forbidden — not on 5xx so a blip doesn't look like a bad password
        if (res.status === 401 || res.status === 403) {
          await signOut(clientAuth());
        }
        throw new Error(
          data.error ||
            (res.status >= 500
              ? "Server error verifying admin. Try again."
              : "Only admins can sign in to this dashboard")
        );
      }

      const profile = data as AdminProfile;
      adminProfileRef.current = profile;
      setIsAdmin(true);
      setToken(t);
      setUser(u);
      return profile;
    })();

    verifyInFlight.current = run;
    try {
      return await run;
    } finally {
      if (verifyInFlight.current === run) verifyInFlight.current = null;
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(clientAuth(), async (u) => {
      if (!u) {
        setUser(null);
        setToken(null);
        clearAdmin();
        setLoading(false);
        return;
      }

      setUser(u);
      try {
        setToken(await u.getIdToken());
        // Skip if login form already verified this session
        if (adminProfileRef.current?.uid === u.uid) {
          setIsAdmin(true);
          setLoading(false);
          return;
        }
        await verifyAdmin(u);
      } catch {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, [clearAdmin, verifyAdmin]);

  const signInEmail = useCallback(
    async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(
        clientAuth(),
        email.trim(),
        password
      );
      await verifyAdmin(cred.user);
    },
    [verifyAdmin]
  );

  const signInGoogle = useCallback(async () => {
    const cred = await signInWithPopup(clientAuth(), googleProvider);
    await verifyAdmin(cred.user);
  }, [verifyAdmin]);

  const logout = useCallback(async () => {
    clearAdmin();
    await signOut(clientAuth());
  }, [clearAdmin]);

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const t = token || (user ? await user.getIdToken() : null);
      const headers = new Headers(init?.headers);
      if (t) headers.set("Authorization", `Bearer ${t}`);
      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(path, { ...init, headers });
    },
    [token, user]
  );

  const requireAdminSession = useCallback(async () => {
    const u = clientAuth().currentUser;
    if (!u) throw new Error("Not signed in");
    return verifyAdmin(u);
  }, [verifyAdmin]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAdmin,
      signInEmail,
      signInGoogle,
      logout,
      apiFetch,
      requireAdminSession,
    }),
    [
      user,
      token,
      loading,
      isAdmin,
      signInEmail,
      signInGoogle,
      logout,
      apiFetch,
      requireAdminSession,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
