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
exports.AreasService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const organization_constants_1 = require("../organization.constants");
const organization_helpers_1 = require("../organization.helpers");
const organization_integrity_service_1 = require("../organization-integrity.service");
let AreasService = class AreasService {
    prisma;
    audit;
    integrity;
    constructor(prisma, audit, integrity) {
        this.prisma = prisma;
        this.audit = audit;
        this.integrity = integrity;
    }
    list(companyId) {
        return this.prisma.area.findMany({
            where: { companyId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }
    async tree(companyId) {
        const areas = await this.prisma.area.findMany({
            where: { companyId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
        const nodes = new Map();
        for (const area of areas) {
            nodes.set(area.id, {
                id: area.id,
                name: area.name,
                code: area.code,
                status: area.status,
                businessUnitId: area.businessUnitId,
                parentAreaId: area.parentAreaId,
                children: [],
            });
        }
        const roots = [];
        for (const area of areas) {
            const node = nodes.get(area.id);
            if (!node)
                continue;
            if (area.parentAreaId && nodes.has(area.parentAreaId)) {
                nodes.get(area.parentAreaId)?.children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async create(companyId, userId, dto) {
        if (dto.businessUnitId) {
            await this.integrity.requireBusinessUnit(companyId, dto.businessUnitId);
        }
        if (dto.parentAreaId) {
            await this.integrity.requireArea(companyId, dto.parentAreaId);
            await this.assertAreaParentSafe(companyId, null, dto.parentAreaId);
        }
        const created = await this.prisma.area.create({
            data: {
                companyId,
                name: dto.name.trim(),
                code: (0, organization_helpers_1.emptyToNull)(dto.code) ?? null,
                description: (0, organization_helpers_1.emptyToNull)(dto.description) ?? null,
                businessUnitId: dto.businessUnitId ?? null,
                parentAreaId: dto.parentAreaId ?? null,
                status: dto.status ?? client_1.OrganizationEntityStatus.ACTIVE,
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.AREA_CREATED,
            entity: 'Area',
            entityId: created.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: created.id },
        });
        return created;
    }
    async update(companyId, userId, id, dto) {
        await this.integrity.requireArea(companyId, id);
        if (dto.businessUnitId) {
            await this.integrity.requireBusinessUnit(companyId, dto.businessUnitId);
        }
        if (dto.parentAreaId) {
            if (dto.parentAreaId === id) {
                throw new common_1.BadRequestException('An area cannot be its own parent');
            }
            await this.integrity.requireArea(companyId, dto.parentAreaId);
            await this.assertAreaParentSafe(companyId, id, dto.parentAreaId);
        }
        const updated = await this.prisma.area.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.code !== undefined ? { code: (0, organization_helpers_1.emptyToNull)(dto.code) } : {}),
                ...(dto.description !== undefined
                    ? { description: (0, organization_helpers_1.emptyToNull)(dto.description) }
                    : {}),
                ...(dto.businessUnitId !== undefined
                    ? { businessUnitId: dto.businessUnitId }
                    : {}),
                ...(dto.parentAreaId !== undefined
                    ? { parentAreaId: dto.parentAreaId }
                    : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.AREA_UPDATED,
            entity: 'Area',
            entityId: updated.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: updated.id },
        });
        return updated;
    }
    async assertAreaParentSafe(companyId, areaId, parentAreaId) {
        const areas = await this.prisma.area.findMany({
            where: { companyId, deletedAt: null },
            select: { id: true, parentAreaId: true },
        });
        const parentsById = new Map(areas.map((area) => [area.id, area.parentAreaId]));
        if (!areaId) {
            return;
        }
        (0, organization_helpers_1.assertNoCycle)((0, organization_helpers_1.wouldCreateParentCycle)(areaId, parentAreaId, parentsById), 'Area hierarchy cycle detected');
    }
};
exports.AreasService = AreasService;
exports.AreasService = AreasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        organization_integrity_service_1.OrganizationIntegrityService])
], AreasService);
//# sourceMappingURL=areas.service.js.map