import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiRequest } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("edusync_token") || "");
  const [user, setUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(token));

  const login = useCallback(async (identifier, password) => {
    const data = await apiRequest("/auth/login", "POST", { identifier, password });
    const profile = await apiRequest("/auth/me", "GET", null, data.access_token);
    localStorage.setItem("edusync_token", data.access_token);
    setUser(profile);
    setToken(data.access_token);
  }, []);

  const register = useCallback(
    (payload) => apiRequest("/auth/register", "POST", payload),
    []
  );

  const forgotPassword = useCallback(
    (email, channel = "email") => apiRequest("/auth/forgot-password", "POST", { email, channel }),
    []
  );

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    setProfileLoading(false);
    localStorage.removeItem("edusync_token");
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setProfileLoading(false);
      return undefined;
    }
    let active = true;
    setProfileLoading(true);
    apiRequest("/auth/me", "GET", null, token)
      .then((profile) => { if (active) setUser(profile); })
      .catch(() => { if (active) logout(); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [token, logout]);

  const value = { token, user, profileLoading, login, register, forgotPassword, logout, isAuthenticated: Boolean(token) };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
