import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { setAuthToken, clearAuthToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => {
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("gt_auth_user") : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const setUser = (newUser) => {
    setUserState(newUser);
    if (newUser) {
      try { localStorage.setItem("gt_auth_user", JSON.stringify(newUser)); } catch (_) {}
    } else {
      try { localStorage.removeItem("gt_auth_user"); } catch (_) {}
    }
  };

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (err) {
      // Only clear user if the server explicitly rejected the token (401)
      if (err?.response?.status === 401) {
        clearAuthToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* noop */ }
    clearAuthToken();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refresh: checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
