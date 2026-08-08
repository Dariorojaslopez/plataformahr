import { OrganizationEntityStatus } from '@prisma/client';
export declare class CreateJobLevelDto {
    name: string;
    code?: string;
    rank: number;
    status?: OrganizationEntityStatus;
}
export declare class UpdateJobLevelDto {
    name?: string;
    code?: string;
    rank?: number;
    status?: OrganizationEntityStatus;
}
