export type JobOfferStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "WITHDRAWN";

export type SalaryPeriod = "MONTHLY" | "ANNUAL" | "HOURLY";

export type OfferEmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "FIXED_TERM"
  | "CONTRACTOR";

export type JobOfferApplicationRef = {
  id: string;
  stage: string;
  status: string;
  candidateId: string;
  vacancyId: string;
  candidate?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
  vacancy?: {
    id: string;
    title: string;
    status: string;
    filledCount: number;
    headcount: number;
    position?: { id: string; name: string } | null;
  };
};

export type JobOffer = {
  id: string;
  applicationId: string;
  status: JobOfferStatus;
  positionTitle: string;
  salaryAmount: string;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  employmentType: OfferEmploymentType;
  startDate: string | null;
  expiresAt: string | null;
  notes: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  expiredAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  application?: JobOfferApplicationRef;
};

export type CreateJobOfferInput = {
  positionTitle: string;
  salaryAmount: string;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  employmentType?: OfferEmploymentType;
  startDate?: string;
  expiresAt?: string;
  notes?: string;
};

export type UpdateJobOfferInput = {
  positionTitle?: string;
  salaryAmount?: string;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  employmentType?: OfferEmploymentType;
  startDate?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
};
