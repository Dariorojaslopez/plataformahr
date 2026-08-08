import { apiRequest } from "@/lib/api/client";

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
};

export type CreateHiringInput = {
  hireDate?: string;
  businessUnitId?: string;
  phone?: string;
};

export const hiringApi = {
  getByApplication: (applicationId: string) =>
    apiRequest<Hiring>(`/ats/applications/${applicationId}/hiring`),

  hire: (applicationId: string, body: CreateHiringInput = {}) =>
    apiRequest<Hiring>(`/ats/applications/${applicationId}/hire`, {
      method: "POST",
      body,
    }),
};

export const hiringKeys = {
  all: (companyId: string) => ["ats", companyId, "hiring"] as const,
  byApplication: (companyId: string, applicationId: string) =>
    [...hiringKeys.all(companyId), applicationId] as const,
};
