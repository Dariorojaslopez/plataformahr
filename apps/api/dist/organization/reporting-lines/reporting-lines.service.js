"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingLinesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const organization_constants_1 = require("../organization.constants");
const organization_helpers_1 = require("../organization.helpers");
const organization_integrity_service_1 = require("../organization-integrity.service");
let ReportingLinesService = class ReportingLinesService {
    prisma;
    audit;
    integrity;
    constructor(prisma, audit, integrity) {
        this.prisma = prisma;
        this.audit = audit;
        this.integrity = integrity;
    }
    async listForEmployee(companyId, employeeId) {
        await this.integrity.requireEmployee(companyId, employeeId);
        return this.prisma.employeeReportingLine.findMany({
            where: { companyId, employeeId },
            include: {
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true,
                    },
                },
            },
            orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
        });
    }
    async create(companyId, actorUserId, employeeId, dto) {
        await this.integrity.requireEmployee(companyId, employeeId);
        await this.integrity.requireEmployee(companyId, dto.managerEmployeeId);
        if (employeeId === dto.managerEmployeeId) {
            throw new common_1.BadRequestException('Employee cannot report to themselves');
        }
        if (dto.type === client_1.ReportingLineType.DIRECT) {
            const existingDirect = await this.prisma.employeeReportingLine.findFirst({
                where: {
                    companyId,
                    employeeId,
                    type: client_1.ReportingLineType.DIRECT,
                },
            });
            if (existingDirect) {
                throw new common_1.ConflictException('Employee already has a direct manager');
            }
        }
        await this.assertNoReportingCycle(companyId, employeeId, dto.managerEmployeeId);
        try {
            const created = await this.prisma.employeeReportingLine.create({
                data: {
                    companyId,
                    employeeId,
                    managerEmployeeId: dto.managerEmployeeId,
                    type: dto.type,
                },
            });
            await this.audit.create({
                action: organization_constants_1.ORG_AUDIT.REPORTING_LINE_CREATED,
                entity: 'EmployeeReportingLine',
                entityId: created.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: actorUserId } },
                metadata: {
                    id: created.id,
                    employeeId,
                    managerEmployeeId: dto.managerEmployeeId,
                    type: dto.type,
                },
            });
            return created;
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Reporting line already exists');
            }
            throw error;
        }
    }
    async remove(companyId, actorUserId, employeeId, reportingLineId) {
        await this.integrity.requireEmployee(companyId, employeeId);
        const line = await this.prisma.employeeReportingLine.findFirst({
            where: {
                id: reportingLineId,
                companyId,
                employeeId,
            },
        });
        if (!line) {
            throw new common_1.NotFoundException('Reporting line not found');
        }
        await this.prisma.employeeReportingLine.delete({
            where: { id: reportingLineId },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.REPORTING_LINE_REMOVED,
            entity: 'EmployeeReportingLine',
            entityId: reportingLineId,
            company: { connect: { id: companyId } },
            user: { connect: { id: actorUserId } },
            metadata: {
                id: reportingLineId,
                employeeId,
                managerEmployeeId: line.managerEmployeeId,
                type: line.type,
            },
        });
    }
    async assertNoReportingCycle(companyId, employeeId, managerEmployeeId) {
        const lines = await this.prisma.employeeReportingLine.findMany({
            where: { companyId },
            select: {
                employeeId: true,
                managerEmployeeId: true,
            },
        });
        const reportsToByEmployee = new Map();
        for (const line of lines) {
            const current = reportsToByEmployee.get(line.employeeId) ?? [];
            current.push(line.managerEmployeeId);
            reportsToByEmployee.set(line.employeeId, current);
        }
        (0, organization_helpers_1.assertNoCycle)((0, organization_helpers_1.wouldCreateReportingCycle)(employeeId, managerEmployeeId, reportsToByEmployee), 'Reporting line cycle detected');
    }
};
exports.ReportingLinesService = ReportingLinesService;
exports.ReportingLinesService = ReportingLinesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        organization_integrity_service_1.OrganizationIntegrityService])
], ReportingLinesService);
//# sourceMappingURL=reporting-lines.service.js.map