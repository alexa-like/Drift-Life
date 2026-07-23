import { useState, useEffect, useCallback } from "react";
import { User } from "../types";
import { api } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setState({ user: null, loading: false });
      return;
    }
    try {
      const user = await api.get<User>("/user/me");
      setState({ user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    fetchMe();
    const handleLogout = () => setState({ user: null, loading: false });
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [fetchMe]);

  const login = useCallback((accessToken: string, refreshToken: string, user: User) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setState({ user, loading: false });
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setState({ user: null, loading: false });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await api.get<User>("/user/me");
      setState(s => ({ ...s, user }));
      return user;
    } catch {
      return null;
    }
  }, []);

  return { ...state, login, logout, refreshUser };
}
