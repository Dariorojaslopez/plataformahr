import { type BusinessUnit } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBusinessUnitDto, UpdateBusinessUnitDto } from './dto/business-unit.dto';
export declare class BusinessUnitsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(companyId: string): Promise<BusinessUnit[]>;
    create(companyId: string, userId: string, dto: CreateBusinessUnitDto): Promise<BusinessUnit>;
    update(companyId: string, userId: string, id: string, dto: UpdateBusinessUnitDto): Promise<BusinessUnit>;
    private requireInCompany;
}
