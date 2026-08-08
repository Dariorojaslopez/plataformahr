import { apiRequest } from "@/lib/api/client";
import type {
  AuthMeResponse,
  AuthTokensResponse,
  PlatformMeResponse,
} from "@/types/auth";

export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  return apiRequest<AuthTokensResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
    companyId: null,
  });
}

export async function logoutRequest(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/auth/logout", {
    method: "POST",
    companyId: null,
  });
}

export async function meRequest(): Promise<AuthMeResponse> {
  return apiRequest<AuthMeResponse>("/auth/me", {
    companyId: null,
  });
}

export async function platformMeRequest(): Promise<PlatformMeResponse> {
  return apiRequest<PlatformMeResponse>("/platform/me", {
    companyId: null,
  });
}
