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
exports.BusinessUnitsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const organization_constants_1 = require("../organization.constants");
const organization_helpers_1 = require("../organization.helpers");
let BusinessUnitsService = class BusinessUnitsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    list(companyId) {
        return this.prisma.businessUnit.findMany({
            where: { companyId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }
    async create(companyId, userId, dto) {
        const created = await this.prisma.businessUnit.create({
            data: {
                companyId,
                name: dto.name.trim(),
                code: (0, organization_helpers_1.emptyToNull)(dto.code) ?? null,
                description: (0, organization_helpers_1.emptyToNull)(dto.description) ?? null,
                status: dto.status ?? client_1.OrganizationEntityStatus.ACTIVE,
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.BUSINESS_UNIT_CREATED,
            entity: 'BusinessUnit',
            entityId: created.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: created.id },
        });
        return created;
    }
    async update(companyId, userId, id, dto) {
        await this.requireInCompany(companyId, id);
        const updated = await this.prisma.businessUnit.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.code !== undefined ? { code: (0, organization_helpers_1.emptyToNull)(dto.code) } : {}),
                ...(dto.description !== undefined
                    ? { description: (0, organization_helpers_1.emptyToNull)(dto.description) }
                    : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.audit.create({
            action: organization_constants_1.ORG_AUDIT.BUSINESS_UNIT_UPDATED,
            entity: 'BusinessUnit',
            entityId: updated.id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: { id: updated.id },
        });
        return updated;
    }
    async requireInCompany(companyId, id) {
        const existing = await this.prisma.businessUnit.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Business unit not found');
        }
    }
};
exports.BusinessUnitsService = BusinessUnitsService;
exports.BusinessUnitsService = BusinessUnitsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], BusinessUnitsService);
//# sourceMappingURL=business-units.service.js.map