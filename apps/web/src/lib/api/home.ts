import { apiRequest, apiRequestBlob } from "@/lib/api/client";

export type HomeProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  housingType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  areaName: string | null;
  positionName: string | null;
};

export type HomeOpenVacancy = {
  id: string;
  title: string;
  description: string | null;
  areaName: string;
  published: boolean;
};

export type HomePendingApproval = {
  id: string;
  title: string;
  requesterName: string;
};

export type HomePendingEvaluation = {
  id: string;
  status: string;
  scheduledAt: string | null;
  candidateName: string;
  vacancyTitle: string;
};

export type CollaboratorHomeFeed = {
  profile: HomeProfile | null;
  openVacancies: HomeOpenVacancy[];
  pendingApprovals: HomePendingApproval[];
  pendingEvaluations: HomePendingEvaluation[];
  assignedVacancies: HomeAssignedVacancy[];
  assignedMetrics: HomeAssignedMetrics;
};

export type HomeAssignedVacancy = {
  id: string;
  title: string;
  status: string;
  areaName: string;
  headcount: number;
  filledCount: number;
  applicationCount: number;
};

export type HomeAssignedMetrics = {
  vacancyCount: number;
  openCount: number;
  applicationCount: number;
  activeApplicationCount: number;
  hiredCount: number;
  pendingInterviewCount: number;
  filledHeadcount: number;
  requestedHeadcount: number;
};

export const EMPTY_ASSIGNED_METRICS: HomeAssignedMetrics = {
  vacancyCount: 0,
  openCount: 0,
  applicationCount: 0,
  activeApplicationCount: 0,
  hiredCount: 0,
  pendingInterviewCount: 0,
  filledHeadcount: 0,
  requestedHeadcount: 0,
};

export type UpdateHomeProfileInput = {
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  maritalStatus?: string;
  childrenCount?: number | null;
  housingType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type InternalJobApplicationInput = {
  phone?: string;
  documentType?: string;
  documentNumber?: string;
};

export type HomeCompanyInfoMediaKind = "IMAGE" | "VIDEO";

export type HomeCompanyInfo = {
  title: string;
  description: string;
  publishedAt: string | null;
  unpublishedAt: string | null;
  mediaKind: HomeCompanyInfoMediaKind | null;
  hasMedia: boolean;
  isLive: boolean;
  mediaUpdatedAt: string | null;
};

export const EMPTY_HOME_COMPANY_INFO: HomeCompanyInfo = {
  title: "",
  description: "",
  publishedAt: null,
  unpublishedAt: null,
  mediaKind: null,
  hasMedia: false,
  isLive: false,
  mediaUpdatedAt: null,
};

export type UpdateHomeCompanyInfoInput = {
  title: string;
  description?: string;
  publishedAt: string;
  unpublishedAt?: string | null;
};

export const homeApi = {
  getFeed: () => apiRequest<CollaboratorHomeFeed>("/home"),
  updateProfile: (body: UpdateHomeProfileInput) =>
    apiRequest<HomeProfile>("/home/profile", { method: "PATCH", body }),
  applyToVacancy: (id: string, body: InternalJobApplicationInput = {}) =>
    apiRequest<{ ok: true }>(`/home/vacancies/${id}/apply`, {
      method: "POST",
      body,
    }),
  getCompanyInfo: () => apiRequest<HomeCompanyInfo>("/home/company-info"),
  updateCompanyInfo: (body: UpdateHomeCompanyInfoInput) =>
    apiRequest<HomeCompanyInfo>("/home/company-info", {
      method: "PATCH",
      body,
    }),
  uploadCompanyInfoMedia: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<HomeCompanyInfo>("/home/company-info/media", {
      method: "POST",
      formData,
    });
  },
  removeCompanyInfoMedia: () =>
    apiRequest<HomeCompanyInfo>("/home/company-info/media", {
      method: "DELETE",
    }),
  getCompanyInfoMediaBlob: () =>
    apiRequestBlob("/home/company-info/media", {
      headers: { Accept: "image/*, video/*, application/octet-stream" },
    }),
};

export const homeKeys = {
  feed: (companyId: string) => ["home", companyId, "feed"] as const,
  companyInfo: (companyId: string) =>
    ["home", companyId, "company-info"] as const,
  companyInfoMedia: (companyId: string, mediaUpdatedAt: string | null) =>
    ["home", companyId, "company-info-media", mediaUpdatedAt] as const,
};
