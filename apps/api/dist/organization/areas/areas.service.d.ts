import { OrganizationEntityStatus, type Area } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';
export type AreaTreeNode = {
    id: string;
    name: string;
    code: string | null;
    status: OrganizationEntityStatus;
    businessUnitId: string | null;
    parentAreaId: string | null;
    children: AreaTreeNode[];
};
export declare class AreasService {
    private readonly prisma;
    private readonly audit;
    private readonly integrity;
    constructor(prisma: PrismaService, audit: AuditService, integrity: OrganizationIntegrityService);
    list(companyId: string): Promise<Area[]>;
    tree(companyId: string): Promise<AreaTreeNode[]>;
    create(companyId: string, userId: string, dto: CreateAreaDto): Promise<Area>;
    update(companyId: string, userId: string, id: string, dto: UpdateAreaDto): Promise<Area>;
    private assertAreaParentSafe;
}
