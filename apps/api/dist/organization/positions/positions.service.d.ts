import { type Position } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
export declare class PositionsService {
    private readonly prisma;
    private readonly audit;
    private readonly integrity;
    constructor(prisma: PrismaService, audit: AuditService, integrity: OrganizationIntegrityService);
    list(companyId: string): Promise<Position[]>;
    getById(companyId: string, id: string): Promise<Position>;
    create(companyId: string, userId: string, dto: CreatePositionDto): Promise<Position>;
    update(companyId: string, userId: string, id: string, dto: UpdatePositionDto): Promise<Position>;
}
