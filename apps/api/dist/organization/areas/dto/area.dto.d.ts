import { OrganizationEntityStatus } from '@prisma/client';
export declare class CreateAreaDto {
    name: string;
    code?: string;
    description?: string;
    businessUnitId?: string;
    parentAreaId?: string;
    status?: OrganizationEntityStatus;
}
export declare class UpdateAreaDto {
    name?: string;
    code?: string;
    description?: string;
    businessUnitId?: string | null;
    parentAreaId?: string | null;
    status?: OrganizationEntityStatus;
}
