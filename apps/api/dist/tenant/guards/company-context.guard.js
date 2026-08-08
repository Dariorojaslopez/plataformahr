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
exports.CompanyContextGuard = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const auth_types_1 = require("../../auth/auth.types");
const prisma_service_1 = require("../../prisma/prisma.service");
let CompanyContextGuard = class CompanyContextGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.UnauthorizedException();
        }
        const headerValue = request.headers[auth_types_1.COMPANY_ID_HEADER];
        const companyId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        if (!companyId || typeof companyId !== 'string') {
            throw new common_1.ForbiddenException('X-Company-Id header is required');
        }
        const membership = await this.prisma.companyMembership.findUnique({
            where: {
                userId_companyId: {
                    userId: user.userId,
                    companyId,
                },
            },
            include: {
                company: true,
                user: true,
            },
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Invalid company membership');
        }
        if (membership.user.deletedAt !== null ||
            membership.user.status !== client_1.UserStatus.ACTIVE) {
            throw new common_1.ForbiddenException('Invalid company membership');
        }
        if (membership.status !== client_1.MembershipStatus.ACTIVE) {
            throw new common_1.ForbiddenException('Membership is not active');
        }
        if (membership.company.deletedAt !== null ||
            membership.company.status !== client_1.CompanyStatus.ACTIVE) {
            throw new common_1.ForbiddenException('Company is not available');
        }
        request.tenantContext = {
            userId: user.userId,
            companyId: membership.companyId,
            membershipId: membership.id,
        };
        return true;
    }
};
exports.CompanyContextGuard = CompanyContextGuard;
exports.CompanyContextGuard = CompanyContextGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompanyContextGuard);
//# sourceMappingURL=company-context.guard.js.map