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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const users_service_1 = require("../core/users/users.service");
const platform_owner_only_decorator_1 = require("./decorators/platform-owner-only.decorator");
const platform_owner_guard_1 = require("./guards/platform-owner.guard");
let PlatformController = class PlatformController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async me(authUser) {
        const user = await this.usersService.findById(authUser.userId);
        if (!user) {
            return null;
        }
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isPlatformOwner: user.isPlatformOwner,
        };
    }
};
exports.PlatformController = PlatformController;
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, platform_owner_guard_1.PlatformOwnerGuard),
    (0, platform_owner_only_decorator_1.PlatformOwnerOnly)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PlatformController.prototype, "me", null);
exports.PlatformController = PlatformController = __decorate([
    (0, common_1.Controller)('platform'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], PlatformController);
//# sourceMappingURL=platform.controller.js.map