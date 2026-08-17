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
  ManagedPlatformOwner,
  CreatePlatformOwnerInput,
  UpdatePlatformOwnerInput,
  CompanyAccess,
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

export function currentCompanyAccessRequest(): Promise<CompanyAccess> {
  return apiRequest<CompanyAccess>("/companies/current/features");
}

export function updateManagedCompanyFeaturesRequest(
  id: string,
  body: CompanyAccess,
): Promise<CompanyAccess> {
  return apiRequest<CompanyAccess>(
    `/platform/admin/companies/${id}/features`,
    {
      method: "PUT",
      body,
      companyId: null,
    },
  );
}

export function resetManagedCompanyAdminPasswordRequest(
  id: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(
    `/platform/admin/companies/${id}/initial-admin/reset-password`,
    {
      method: "POST",
      body: { newPassword },
      companyId: null,
    },
  );
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

export function platformOwnersRequest(): Promise<ManagedPlatformOwner[]> {
  return apiRequest<ManagedPlatformOwner[]>("/platform/admin/owners", {
    companyId: null,
  });
}

export function createPlatformOwnerRequest(
  body: CreatePlatformOwnerInput,
): Promise<{
  owner: ManagedPlatformOwner;
  temporaryPassword: string;
}> {
  return apiRequest("/platform/admin/owners", {
    method: "POST",
    body,
    companyId: null,
  });
}

export function updatePlatformOwnerRequest(
  id: string,
  body: UpdatePlatformOwnerInput,
): Promise<ManagedPlatformOwner> {
  return apiRequest<ManagedPlatformOwner>(`/platform/admin/owners/${id}`, {
    method: "PATCH",
    body,
    companyId: null,
  });
}

export function resetPlatformOwnerPasswordRequest(
  id: string,
): Promise<{ temporaryPassword: string }> {
  return apiRequest(`/platform/admin/owners/${id}/reset-password`, {
    method: "POST",
    companyId: null,
  });
}
