import { create } from "zustand";
import type { User, LoginRequest, RegisterRequest, AuthResponse } from "@/types/auth";
import { apiClient, setStoredAuth, clearStoredAuth, getStoredAuth } from "@/api/client";
import { API_BASE } from "@/utils/constants";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
  hydrateFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
      setStoredAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + data.expiresIn * 1000,
      });
      localStorage.setItem("bb_user", JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Login failed. Please check your credentials.";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.post<AuthResponse>("/auth/register", payload);
      setStoredAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + data.expiresIn * 1000,
      });
      localStorage.setItem("bb_user", JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Registration failed. Please try again.";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Clear local state regardless of server response
    }
    clearStoredAuth();
    localStorage.removeItem("bb_user");
    set({ user: null, isAuthenticated: false, error: null });
  },

  refresh: async () => {
    const stored = getStoredAuth();
    if (!stored?.refreshToken) {
      get().logout();
      return;
    }
    try {
      const { data } = await apiClient.post<AuthResponse>(`${API_BASE}/auth/refresh`, {
        refreshToken: stored.refreshToken,
      });
      setStoredAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + data.expiresIn * 1000,
      });
      localStorage.setItem("bb_user", JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  setUser: (user) => set({ user, isAuthenticated: user !== null }),

  clearError: () => set({ error: null }),

  hydrateFromStorage: () => {
    const stored = getStoredAuth();
    const userRaw = localStorage.getItem("bb_user");
    if (stored?.accessToken && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        set({ user, isAuthenticated: true });
      } catch {
        clearStoredAuth();
        localStorage.removeItem("bb_user");
      }
    }
  },
}));
