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
exports.OrganizationIntegrityService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let OrganizationIntegrityService = class OrganizationIntegrityService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async requireBusinessUnit(companyId, id) {
        const entity = await this.prisma.businessUnit.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!entity) {
            throw new common_1.NotFoundException('Business unit not found');
        }
        return entity;
    }
    async requireArea(companyId, id) {
        const entity = await this.prisma.area.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!entity) {
            throw new common_1.NotFoundException('Area not found');
        }
        return entity;
    }
    async requireJobLevel(companyId, id) {
        const entity = await this.prisma.jobLevel.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!entity) {
            throw new common_1.NotFoundException('Job level not found');
        }
        return entity;
    }
    async requirePosition(companyId, id) {
        const entity = await this.prisma.position.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!entity) {
            throw new common_1.NotFoundException('Position not found');
        }
        return entity;
    }
    async requireEmployee(companyId, id) {
        const entity = await this.prisma.employee.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!entity) {
            throw new common_1.NotFoundException('Employee not found');
        }
        return entity;
    }
    async assertUserMembership(companyId, userId) {
        const membership = await this.prisma.companyMembership.findUnique({
            where: {
                userId_companyId: { userId, companyId },
            },
        });
        if (!membership || membership.status !== client_1.MembershipStatus.ACTIVE) {
            throw new common_1.NotFoundException('Linked user must have an active membership in this company');
        }
    }
};
exports.OrganizationIntegrityService = OrganizationIntegrityService;
exports.OrganizationIntegrityService = OrganizationIntegrityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationIntegrityService);
//# sourceMappingURL=organization-integrity.service.js.map