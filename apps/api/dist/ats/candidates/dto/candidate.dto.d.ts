import { CandidateStatus } from '@prisma/client';
export declare class CreateCandidateDto {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    documentType?: string;
    documentNumber?: string;
    country?: string;
    state?: string;
    city?: string;
    source?: string;
}
export declare class UpdateCandidateDto {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    documentType?: string;
    documentNumber?: string;
    country?: string;
    state?: string;
    city?: string;
    source?: string;
    status?: CandidateStatus;
}
export declare class ListCandidatesQueryDto {
    status?: CandidateStatus;
    search?: string;
    page?: number;
    limit?: number;
}
