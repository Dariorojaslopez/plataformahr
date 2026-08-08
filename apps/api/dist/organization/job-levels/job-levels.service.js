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
exports.JobLevelsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const organization_constants_1 = require("../organization.constants");
const organization_helpers_1 = require("../organization.helpers");
let JobLevelsService = class JobLevelsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    list(companyId) {
        return this.prisma.jobLevel.findMany({
            where: { companyId, deletedAt: null },
            orderBy: { rank: 'asc' },
        });
    }
    async create(companyId, userId, dto) {
        const created = await this.prisma.jobLevel.create({
            data: {
                companyId,
                name: dto.name.trim(),
                code: (0, organization_helpers_1.emptyToNull)(dto.code) ?? null,
                rank: dto.rank,
                status: dto.status ?? client_1.OrganizationEntityStatus.ACTIVE,
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.JOB_LEVEL_CREATED,
            entity: 'JobLevel',
            entityId: created.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: created.id },
        });
        return created;
    }
    async update(companyId, userId, id, dto) {
        const existing = await this.prisma.jobLevel.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Job level not found');
        }
        const updated = await this.prisma.jobLevel.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.code !== undefined ? { code: (0, organization_helpers_1.emptyToNull)(dto.code) } : {}),
                ...(dto.rank !== undefined ? { rank: dto.rank } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.JOB_LEVEL_UPDATED,
            entity: 'JobLevel',
            entityId: updated.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: updated.id },
        });
        return updated;
    }
};
exports.JobLevelsService = JobLevelsService;
exports.JobLevelsService = JobLevelsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], JobLevelsService);
//# sourceMappingURL=job-levels.service.js.map