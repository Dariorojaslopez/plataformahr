import { apiRequest, apiRequestBlob } from "@/lib/api/client";
import type {
  PreHireCheckStatus,
  PreHireDocumentKind,
  ApplicationPreHireDocument,
} from "@/types/ats";

export type HiringEmployeeRef = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  hireDate: string | null;
  positionId: string;
  areaId: string;
  businessUnitId: string | null;
};

export type Hiring = {
  id: string;
  applicationId: string;
  jobOfferId: string;
  employeeId: string;
  candidateId: string;
  vacancyId: string;
  hiredByUserId: string;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
  employee?: HiringEmployeeRef;
  jobOffer?: { id: string; status: string; positionTitle: string };
  application?: {
    id: string;
    stage: string;
    status: string;
    candidateId: string;
    vacancyId: string;
  };
  pdi?: HirePdiSyncResult;
};

export type HirePdiSyncResult = {
  status:
    | "SYNCED"
    | "SKIPPED_NO_FEATURE"
    | "SKIPPED_NO_CYCLE"
    | "SKIPPED_EMPTY";
  cycleId?: string;
  cycleName?: string;
  pdiId?: string;
  draftName?: string;
};

export type ApplicationPdiDraft = {
  applicationId: string;
  candidateName: string;
  vacancyTitle: string;
  canDownload: boolean;
  draft: {
    name: string;
    strengths: string | null;
    improvements: string | null;
    observations: string | null;
    sourceCount: number;
  };
};

export type CreateHiringInput = {
  hireDate?: string;
  businessUnitId?: string;
  phone?: string;
};

export type ApplicationPreHire = {
  applicationId: string;
  securityStudyStatus: PreHireCheckStatus;
  medicalExamStatus: PreHireCheckStatus;
  ready: boolean;
  documents: ApplicationPreHireDocument[];
};

export type UpdatePreHireInput = {
  securityStudyStatus?: PreHireCheckStatus;
  medicalExamStatus?: PreHireCheckStatus;
};

export const hiringApi = {
  getByApplication: (applicationId: string) =>
    apiRequest<Hiring>(`/ats/applications/${applicationId}/hiring`),

  hire: (applicationId: string, body: CreateHiringInput = {}) =>
    apiRequest<Hiring>(`/ats/applications/${applicationId}/hire`, {
      method: "POST",
      body,
    }),

  getPdi: (applicationId: string) =>
    apiRequest<ApplicationPdiDraft>(`/ats/applications/${applicationId}/pdi`),

  downloadPdi: (applicationId: string) =>
    apiRequestBlob(`/ats/applications/${applicationId}/pdi/download`),

  syncPdi: (applicationId: string) =>
    apiRequest<HirePdiSyncResult>(
      `/ats/applications/${applicationId}/pdi/sync`,
      { method: "POST" },
    ),

  getPreHire: (applicationId: string) =>
    apiRequest<ApplicationPreHire>(
      `/ats/applications/${applicationId}/prehire`,
    ),

  updatePreHire: (applicationId: string, body: UpdatePreHireInput) =>
    apiRequest<ApplicationPreHire>(
      `/ats/applications/${applicationId}/prehire`,
      { method: "PATCH", body },
    ),

  uploadPreHireDocument: (
    applicationId: string,
    kind: PreHireDocumentKind,
    file: File,
  ) => {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);
    return apiRequest<ApplicationPreHire>(
      `/ats/applications/${applicationId}/prehire/documents`,
      { method: "POST", formData },
    );
  },

  downloadPreHireDocument: (
    applicationId: string,
    kind: PreHireDocumentKind,
  ) =>
    apiRequestBlob(
      `/ats/applications/${applicationId}/prehire/documents/${kind}`,
    ),
};

export const hiringKeys = {
  all: (companyId: string) => ["ats", companyId, "hiring"] as const,
  byApplication: (companyId: string, applicationId: string) =>
    [...hiringKeys.all(companyId), applicationId] as const,
  preHire: (companyId: string, applicationId: string) =>
    [...hiringKeys.all(companyId), applicationId, "prehire"] as const,
  pdi: (companyId: string, applicationId: string) =>
    [...hiringKeys.all(companyId), applicationId, "pdi"] as const,
};
