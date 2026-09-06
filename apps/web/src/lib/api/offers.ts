import type {
  CreateJobOfferInput,
  JobOffer,
  OfferContractApprovals,
  OfferLetterStatus,
  UpdateJobOfferInput,
} from "@/types/offers";
import { apiRequest, apiRequestBlob } from "@/lib/api/client";

export const offersApi = {
  getByApplication: (applicationId: string) =>
    apiRequest<JobOffer>(`/ats/applications/${applicationId}/offer`),

  createForApplication: (applicationId: string, body: CreateJobOfferInput) =>
    apiRequest<JobOffer>(`/ats/applications/${applicationId}/offer`, {
      method: "POST",
      body,
    }),

  getById: (id: string) => apiRequest<JobOffer>(`/ats/offers/${id}`),

  update: (id: string, body: UpdateJobOfferInput) =>
    apiRequest<JobOffer>(`/ats/offers/${id}`, {
      method: "PATCH",
      body,
    }),

  send: (id: string) =>
    apiRequest<JobOffer>(`/ats/offers/${id}/send`, { method: "POST" }),

  accept: (id: string) =>
    apiRequest<JobOffer>(`/ats/offers/${id}/accept`, { method: "POST" }),

  reject: (id: string) =>
    apiRequest<JobOffer>(`/ats/offers/${id}/reject`, { method: "POST" }),

  withdraw: (id: string) =>
    apiRequest<JobOffer>(`/ats/offers/${id}/withdraw`, { method: "POST" }),

  getLetterStatus: (id: string) =>
    apiRequest<OfferLetterStatus>(`/ats/offers/${id}/letter`),

  downloadLetterTemplate: (id: string) =>
    apiRequestBlob(`/ats/offers/${id}/letter-template`),

  uploadSignedLetter: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<OfferLetterStatus>(`/ats/offers/${id}/signed-letter`, {
      method: "POST",
      formData,
    });
  },

  downloadSignedLetter: (id: string) =>
    apiRequestBlob(`/ats/offers/${id}/signed-letter`),

  removeSignedLetter: (id: string) =>
    apiRequest<OfferLetterStatus>(`/ats/offers/${id}/signed-letter`, {
      method: "DELETE",
    }),

  getContractApprovals: (id: string) =>
    apiRequest<OfferContractApprovals>(`/ats/offers/${id}/contract-approvals`),

  approveContractStep: (id: string, stepId: string, comment?: string) =>
    apiRequest<OfferContractApprovals>(
      `/ats/offers/${id}/contract-approvals/${stepId}/approve`,
      { method: "POST", body: { comment } },
    ),

  rejectContractStep: (id: string, stepId: string, comment?: string) =>
    apiRequest<OfferContractApprovals>(
      `/ats/offers/${id}/contract-approvals/${stepId}/reject`,
      { method: "POST", body: { comment } },
    ),
};

export const offerKeys = {
  all: (companyId: string) => ["ats", companyId, "offers"] as const,
  byApplication: (companyId: string, applicationId: string) =>
    [...offerKeys.all(companyId), "application", applicationId] as const,
  detail: (companyId: string, id: string) =>
    [...offerKeys.all(companyId), "detail", id] as const,
  letter: (companyId: string, id: string) =>
    [...offerKeys.all(companyId), "letter", id] as const,
  contractApprovals: (companyId: string, id: string) =>
    [...offerKeys.all(companyId), "contract-approvals", id] as const,
};
