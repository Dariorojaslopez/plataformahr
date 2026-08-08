import { ApplicationStage, ApplicationStatus } from '@prisma/client';
export declare class CreateApplicationDto {
    candidateId: string;
    vacancyId: string;
}
export declare class CreateApplicationForCandidateDto {
    vacancyId: string;
}
export declare class MoveApplicationDto {
    stage: ApplicationStage;
    comment?: string;
}
export declare class ListApplicationsQueryDto {
    vacancyId?: string;
    candidateId?: string;
    stage?: ApplicationStage;
    status?: ApplicationStatus;
    areaId?: string;
    positionId?: string;
    search?: string;
    page?: number;
    limit?: number;
}
