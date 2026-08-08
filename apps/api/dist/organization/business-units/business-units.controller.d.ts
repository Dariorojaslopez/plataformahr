import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { BusinessUnitsService } from './business-units.service';
import { CreateBusinessUnitDto, UpdateBusinessUnitDto } from './dto/business-unit.dto';
export declare class BusinessUnitsController {
    private readonly businessUnitsService;
    constructor(businessUnitsService: BusinessUnitsService);
    list(tenant: TenantContext): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        description: string | null;
    }[]>;
    create(tenant: TenantContext, user: AuthenticatedUser, dto: CreateBusinessUnitDto): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        description: string | null;
    }>;
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateBusinessUnitDto): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        description: string | null;
    }>;
}
