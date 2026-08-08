import { OrganizationEntityStatus } from '@prisma/client';
export declare class CreatePositionDto {
    name: string;
    areaId: string;
    jobLevelId?: string;
    code?: string;
    mission?: string;
    responsibilities?: string;
    requiredExperience?: string;
    requiredEducation?: string;
    headcount?: number;
    status?: OrganizationEntityStatus;
}
export declare class UpdatePositionDto {
    name?: string;
    areaId?: string;
    jobLevelId?: string | null;
    code?: string;
    mission?: string;
    responsibilities?: string;
    requiredExperience?: string;
    requiredEducation?: string;
    headcount?: number;
    status?: OrganizationEntityStatus;
}
