import { apiRequest } from "@/lib/api/client";
import type {
  CreateJobOfferInput,
  JobOffer,
  UpdateJobOfferInput,
} from "@/types/offers";

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
};

export const offerKeys = {
  all: (companyId: string) => ["ats", companyId, "offers"] as const,
  byApplication: (companyId: string, applicationId: string) =>
    [...offerKeys.all(companyId), "application", applicationId] as const,
  detail: (companyId: string, id: string) =>
    [...offerKeys.all(companyId), "detail", id] as const,
};
