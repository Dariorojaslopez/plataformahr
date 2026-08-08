import { Prisma, type AuditLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(data: Prisma.AuditLogCreateInput): Promise<AuditLog>;
    listByCompany(companyId: string): Promise<AuditLog[]>;
}
