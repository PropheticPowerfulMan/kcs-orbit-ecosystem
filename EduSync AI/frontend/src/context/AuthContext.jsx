import { createContext, useCallback, useContext, useState } from "react";
import { apiRequest } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("edusync_token") || "");

  const login = useCallback(async (email, password) => {
    const data = await apiRequest("/auth/login", "POST", { email, password });
    setToken(data.access_token);
    localStorage.setItem("edusync_token", data.access_token);
  }, []);

  const register = useCallback(
    (payload) => apiRequest("/auth/register", "POST", payload),
    []
  );

  const logout = useCallback(() => {
    setToken("");
    localStorage.removeItem("edusync_token");
  }, []);

  const value = { token, login, register, logout, isAuthenticated: Boolean(token) };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
