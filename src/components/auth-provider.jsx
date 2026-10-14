"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getAuthErrorMessage,
  loginWithBackend,
  logoutFromBackend,
  parseUser,
} from "@/lib/auth";
import { api, registerSessionExpiredCallback } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent the onAuthStateChanged observer from re-running after the initial
  // session restore — subsequent changes are managed by login() / logout().
  const _initDone = useRef(false);

  useEffect(() => {
    // Register a callback so api.js can sign out of Firebase on a 401.
    registerSessionExpiredCallback(() => {
      logoutFromBackend().catch(() => {});
      setUser(null);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (_initDone.current) return;
      _initDone.current = true;

      if (firebaseUser) {
        try {
          const data = await api.get("/auth/me");
          setUser(parseUser(data.user));
        } catch {
          await logoutFromBackend().catch(() => {});
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const authedUser = await loginWithBackend(email, password);
      setUser(authedUser);
      return { ok: true, user: authedUser };
    } catch (err) {
      return { ok: false, error: getAuthErrorMessage(err) };
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutFromBackend().catch(() => {});
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, updateUser }),
    [user, loading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
