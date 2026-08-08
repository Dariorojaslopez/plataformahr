import { type EmployeeReportingLine } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreateReportingLineDto } from './dto/reporting-line.dto';
export declare class ReportingLinesService {
    private readonly prisma;
    private readonly audit;
    private readonly integrity;
    constructor(prisma: PrismaService, audit: AuditService, integrity: OrganizationIntegrityService);
    listForEmployee(companyId: string, employeeId: string): Promise<({
        manager: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.EmployeeStatus;
        };
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.ReportingLineType;
        updatedAt: Date;
        employeeId: string;
        managerEmployeeId: string;
    })[]>;
    create(companyId: string, actorUserId: string, employeeId: string, dto: CreateReportingLineDto): Promise<EmployeeReportingLine>;
    remove(companyId: string, actorUserId: string, employeeId: string, reportingLineId: string): Promise<void>;
    private assertNoReportingCycle;
}
