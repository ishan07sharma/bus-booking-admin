"use client";

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
      const data = await res.json();
      if (!res.ok) {
        setIsAdmin(false);
        adminProfileRef.current = null;
        await signOut(clientAuth());
        throw new Error(data.error || "Only admins can sign in to this dashboard");
      }
      const profile = data as AdminProfile;
      adminProfileRef.current = profile;
      setIsAdmin(true);
      return profile;
    })();

    verifyInFlight.current = run;
    try {
      return await run;
    } finally {
      verifyInFlight.current = null;
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(clientAuth(), async (u) => {
      setUser(u);
      if (!u) {
        setToken(null);
        clearAdmin();
        setLoading(false);
        return;
      }
      setToken(await u.getIdToken());
      // One admin check per signed-in session (also covers page refresh)
      try {
        await verifyAdmin(u);
      } catch {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, [clearAdmin, verifyAdmin]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(clientAuth(), email, password);
  }, []);

  const signInGoogle = useCallback(async () => {
    await signInWithPopup(clientAuth(), googleProvider);
  }, []);

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
