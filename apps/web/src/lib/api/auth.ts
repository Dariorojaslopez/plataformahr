import { apiRequest } from "@/lib/api/client";
import type {
  AuthMeResponse,
  AuthTokensResponse,
  PlatformMeResponse,
  PublicCompany,
  ManagedCompany,
  CreateManagedCompanyInput,
  CreateManagedCompanyResponse,
  PublicUser,
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

export async function platformCompaniesRequest(): Promise<PublicCompany[]> {
  return apiRequest<PublicCompany[]>("/platform/companies", {
    companyId: null,
  });
}

export function managedCompaniesRequest(): Promise<ManagedCompany[]> {
  return apiRequest<ManagedCompany[]>("/platform/admin/companies", {
    companyId: null,
  });
}

export function createManagedCompanyRequest(
  body: CreateManagedCompanyInput,
): Promise<CreateManagedCompanyResponse> {
  return apiRequest<CreateManagedCompanyResponse>("/platform/admin/companies", {
    method: "POST",
    body,
    companyId: null,
  });
}

export function updateManagedCompanyStatusRequest(
  id: string,
  status: ManagedCompany["status"],
): Promise<ManagedCompany> {
  return apiRequest<ManagedCompany>(`/platform/admin/companies/${id}/status`, {
    method: "PATCH",
    body: { status },
    companyId: null,
  });
}

export function grantPlatformTenantAccessRequest(
  id: string,
): Promise<PublicCompany> {
  return apiRequest<PublicCompany>(`/platform/admin/companies/${id}/access`, {
    method: "POST",
    companyId: null,
  });
}

export function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
): Promise<{ accessToken: string; user: PublicUser }> {
  return apiRequest("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
    companyId: null,
  });
}
