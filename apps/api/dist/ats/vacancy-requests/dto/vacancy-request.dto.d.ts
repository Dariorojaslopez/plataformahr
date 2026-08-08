import { VacancyRequestStatus, VacancyRequestType } from '@prisma/client';
export declare class CreateVacancyRequestDto {
    type: VacancyRequestType;
    requestedByEmployeeId?: string;
    existingPositionId?: string;
    requestedPositionName?: string;
    requestedAreaId?: string;
    requestedJobLevelId?: string;
    requestedHeadcount: number;
    justification: string;
    generalManagerApprovalRequired?: boolean;
}
export declare class UpdateVacancyRequestDto {
    type?: VacancyRequestType;
    requestedByEmployeeId?: string;
    existingPositionId?: string | null;
    requestedPositionName?: string | null;
    requestedAreaId?: string | null;
    requestedJobLevelId?: string | null;
    requestedHeadcount?: number;
    justification?: string;
    generalManagerApprovalRequired?: boolean;
}
export declare class ListVacancyRequestsQueryDto {
    status?: VacancyRequestStatus;
    type?: VacancyRequestType;
    requestedByEmployeeId?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export declare class ApprovalDecisionDto {
    comment?: string;
}
export declare class RejectDecisionDto {
    comment: string;
}
