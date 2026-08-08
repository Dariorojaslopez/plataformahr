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
exports.PlatformOwnerGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const platform_owner_only_decorator_1 = require("../decorators/platform-owner-only.decorator");
let PlatformOwnerGuard = class PlatformOwnerGuard {
    reflector;
    prisma;
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const required = this.reflector.getAllAndOverride(platform_owner_only_decorator_1.PLATFORM_OWNER_ONLY_KEY, [context.getHandler(), context.getClass()]);
        if (!required) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            throw new common_1.UnauthorizedException();
        }
        const user = await this.prisma.user.findUnique({
            where: { id: request.user.userId },
        });
        if (!user ||
            user.deletedAt !== null ||
            user.status !== client_1.UserStatus.ACTIVE ||
            !user.isPlatformOwner) {
            throw new common_1.ForbiddenException('Platform owner access required');
        }
        return true;
    }
};
exports.PlatformOwnerGuard = PlatformOwnerGuard;
exports.PlatformOwnerGuard = PlatformOwnerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], PlatformOwnerGuard);
//# sourceMappingURL=platform-owner.guard.js.map