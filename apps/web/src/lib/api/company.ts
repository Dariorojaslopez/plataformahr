import { apiRequest, apiRequestBlob } from "@/lib/api/client";
import type { CurrentCompanyResponse } from "@/types/auth";
import type {
  CompanyBranding,
  UpdateCompanyBrandingInput,
} from "@/types/company";

export const companyKeys = {
  all: (companyId: string) => ["company", companyId] as const,
  branding: (companyId: string) =>
    [...companyKeys.all(companyId), "branding"] as const,
  current: (companyId: string) =>
    [...companyKeys.all(companyId), "current"] as const,
  logo: (companyId: string, logoUpdatedAt: string | null) =>
    [...companyKeys.all(companyId), "logo", logoUpdatedAt] as const,
};

export const companyApi = {
  getCurrent: () =>
    apiRequest<CurrentCompanyResponse>("/companies/current"),

  updatePerformanceSettings: (body: {
    goalsCascadeEnabled?: boolean;
    showNineBoxOnMyResults?: boolean;
  }) =>
    apiRequest<CurrentCompanyResponse>(
      "/companies/current/performance-settings",
      { method: "PATCH", body },
    ),

  updateAtsSettings: (body: {
    vacancyHiringSlaDays?: number;
    atsThankYouLetterSubject?: string | null;
    atsThankYouLetterBody?: string | null;
  }) =>
    apiRequest<CurrentCompanyResponse>("/companies/current/ats-settings", {
      method: "PATCH",
      body,
    }),

  uploadAtsTemplate: (kind: "offer-letter" | "contract", file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<CurrentCompanyResponse>(
      `/companies/current/ats-templates/${kind}`,
      { method: "POST", formData },
    );
  },

  removeAtsTemplate: (kind: "offer-letter" | "contract") =>
    apiRequest<CurrentCompanyResponse>(
      `/companies/current/ats-templates/${kind}`,
      { method: "DELETE" },
    ),

  downloadAtsTemplate: (kind: "offer-letter" | "contract") =>
    apiRequestBlob(`/companies/current/ats-templates/${kind}`),

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
