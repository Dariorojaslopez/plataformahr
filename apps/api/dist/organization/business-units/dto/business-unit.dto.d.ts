import { OrganizationEntityStatus } from '@prisma/client';
export declare class CreateBusinessUnitDto {
    name: string;
    code?: string;
    description?: string;
    status?: OrganizationEntityStatus;
}
export declare class UpdateBusinessUnitDto {
    name?: string;
    code?: string;
    description?: string;
    status?: OrganizationEntityStatus;
}
