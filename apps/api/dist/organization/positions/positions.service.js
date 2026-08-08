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
exports.PositionsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const organization_constants_1 = require("../organization.constants");
const organization_helpers_1 = require("../organization.helpers");
const organization_integrity_service_1 = require("../organization-integrity.service");
let PositionsService = class PositionsService {
    prisma;
    audit;
    integrity;
    constructor(prisma, audit, integrity) {
        this.prisma = prisma;
        this.audit = audit;
        this.integrity = integrity;
    }
    list(companyId) {
        return this.prisma.position.findMany({
            where: { companyId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }
    getById(companyId, id) {
        return this.integrity.requirePosition(companyId, id);
    }
    async create(companyId, userId, dto) {
        await this.integrity.requireArea(companyId, dto.areaId);
        if (dto.jobLevelId) {
            await this.integrity.requireJobLevel(companyId, dto.jobLevelId);
        }
        const created = await this.prisma.position.create({
            data: {
                companyId,
                areaId: dto.areaId,
                jobLevelId: dto.jobLevelId ?? null,
                name: dto.name.trim(),
                code: (0, organization_helpers_1.emptyToNull)(dto.code) ?? null,
                mission: (0, organization_helpers_1.emptyToNull)(dto.mission) ?? null,
                responsibilities: (0, organization_helpers_1.emptyToNull)(dto.responsibilities) ?? null,
                requiredExperience: (0, organization_helpers_1.emptyToNull)(dto.requiredExperience) ?? null,
                requiredEducation: (0, organization_helpers_1.emptyToNull)(dto.requiredEducation) ?? null,
                headcount: dto.headcount ?? 1,
                status: dto.status ?? client_1.OrganizationEntityStatus.ACTIVE,
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.POSITION_CREATED,
            entity: 'Position',
            entityId: created.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: created.id },
        });
        return created;
    }
    async update(companyId, userId, id, dto) {
        await this.integrity.requirePosition(companyId, id);
        if (dto.areaId) {
            await this.integrity.requireArea(companyId, dto.areaId);
        }
        if (dto.jobLevelId) {
            await this.integrity.requireJobLevel(companyId, dto.jobLevelId);
        }
        const updated = await this.prisma.position.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
                ...(dto.jobLevelId !== undefined ? { jobLevelId: dto.jobLevelId } : {}),
                ...(dto.code !== undefined ? { code: (0, organization_helpers_1.emptyToNull)(dto.code) } : {}),
                ...(dto.mission !== undefined
                    ? { mission: (0, organization_helpers_1.emptyToNull)(dto.mission) }
                    : {}),
                ...(dto.responsibilities !== undefined
                    ? { responsibilities: (0, organization_helpers_1.emptyToNull)(dto.responsibilities) }
                    : {}),
                ...(dto.requiredExperience !== undefined
                    ? { requiredExperience: (0, organization_helpers_1.emptyToNull)(dto.requiredExperience) }
                    : {}),
                ...(dto.requiredEducation !== undefined
                    ? { requiredEducation: (0, organization_helpers_1.emptyToNull)(dto.requiredEducation) }
                    : {}),
                ...(dto.headcount !== undefined ? { headcount: dto.headcount } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.POSITION_UPDATED,
            entity: 'Position',
            entityId: updated.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: updated.id },
        });
        return updated;
    }
};
exports.PositionsService = PositionsService;
exports.PositionsService = PositionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        organization_integrity_service_1.OrganizationIntegrityService])
], PositionsService);
//# sourceMappingURL=positions.service.js.map