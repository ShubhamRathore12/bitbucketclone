import { apiClient } from "./client";
import type { ApiResponse } from "@/types/common";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
} from "@/types/auth";

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/login", payload);
  return data.data;
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/register", payload);
  return data.data;
}

export async function refreshToken(payload: RefreshTokenRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/refresh", payload);
  return data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getOAuthUrl(
  provider: "google" | "github" | "microsoft",
): Promise<string> {
  const { data } = await apiClient.get<ApiResponse<{ url: string }>>(
    `/auth/oauth/${provider}/url`,
  );
  return data.data.url;
}
