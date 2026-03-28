import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import type { LoginRequest, RegisterRequest } from "@/types/auth";

/**
 * Auth hook wrapping the Zustand auth store with navigation helpers.
 */
export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    register: storeRegister,
    logout: storeLogout,
    clearError,
  } = useAuthStore();

  const navigate = useNavigate();

  const login = useCallback(
    async (payload: LoginRequest) => {
      await storeLogin(payload);
      navigate("/");
    },
    [storeLogin, navigate],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      await storeRegister(payload);
      navigate("/");
    },
    [storeRegister, navigate],
  );

  const logout = useCallback(async () => {
    await storeLogout();
    navigate("/login");
  }, [storeLogout, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}
