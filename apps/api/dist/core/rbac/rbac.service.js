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
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let RbacService = class RbacService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findRoleByScopeAndCode(scope, code) {
        return this.prisma.role.findUnique({
            where: { scope_code: { scope, code } },
        });
    }
    findPermissionByCode(code) {
        return this.prisma.permission.findUnique({ where: { code } });
    }
    listRolesForMembership(membershipId) {
        return this.prisma.membershipRole.findMany({ where: { membershipId } });
    }
    async getPermissionCodesForMembership(membershipId) {
        const links = await this.prisma.membershipRole.findMany({
            where: { membershipId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
        });
        const codes = new Set();
        for (const link of links) {
            for (const rolePermission of link.role.permissions) {
                codes.add(rolePermission.permission.code);
            }
        }
        return codes;
    }
    assignRoleToMembership(membershipId, roleId) {
        return this.prisma.membershipRole.create({
            data: { membershipId, roleId },
        });
    }
    grantPermissionToRole(roleId, permissionId) {
        return this.prisma.rolePermission.create({
            data: { roleId, permissionId },
        });
    }
    createRole(data) {
        return this.prisma.role.create({ data });
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RbacService);
//# sourceMappingURL=rbac.service.js.map