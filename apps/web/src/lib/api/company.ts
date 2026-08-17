import { apiRequest, apiRequestBlob } from "@/lib/api/client";
import type {
  CompanyBranding,
  UpdateCompanyBrandingInput,
} from "@/types/company";

export const companyKeys = {
  all: (companyId: string) => ["company", companyId] as const,
  branding: (companyId: string) =>
    [...companyKeys.all(companyId), "branding"] as const,
  logo: (companyId: string, logoUpdatedAt: string | null) =>
    [...companyKeys.all(companyId), "logo", logoUpdatedAt] as const,
};

export const companyApi = {
  getBranding: () => apiRequest<CompanyBranding>("/companies/current/branding"),

  updateBranding: (body: UpdateCompanyBrandingInput) =>
    apiRequest<CompanyBranding>("/companies/current/branding", {
      method: "PATCH",
      body,
    }),

  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<CompanyBranding>("/companies/current/branding/logo", {
      method: "POST",
      formData,
    });
  },

  removeLogo: () =>
    apiRequest<CompanyBranding>("/companies/current/branding/logo", {
      method: "DELETE",
    }),

  getLogoBlob: () =>
    apiRequestBlob("/companies/current/branding/logo", {
      headers: { Accept: "image/*, application/octet-stream" },
    }),
};
