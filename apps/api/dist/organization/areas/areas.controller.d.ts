import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';
export declare class AreasController {
    private readonly areasService;
    constructor(areasService: AreasService);
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
        businessUnitId: string | null;
        parentAreaId: string | null;
    }[]>;
    tree(tenant: TenantContext): Promise<import("./areas.service").AreaTreeNode[]>;
    create(tenant: TenantContext, user: AuthenticatedUser, dto: CreateAreaDto): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        description: string | null;
        businessUnitId: string | null;
        parentAreaId: string | null;
    }>;
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateAreaDto): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        description: string | null;
        businessUnitId: string | null;
        parentAreaId: string | null;
    }>;
}
