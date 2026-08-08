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
exports.VacancyRequestsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const require_permissions_decorator_1 = require("../../rbac/decorators/require-permissions.decorator");
const permission_guard_1 = require("../../rbac/guards/permission.guard");
const current_tenant_decorator_1 = require("../../tenant/decorators/current-tenant.decorator");
const company_context_guard_1 = require("../../tenant/guards/company-context.guard");
const vacancy_request_dto_1 = require("./dto/vacancy-request.dto");
const vacancy_requests_service_1 = require("./vacancy-requests.service");
let VacancyRequestsController = class VacancyRequestsController {
    vacancyRequestsService;
    constructor(vacancyRequestsService) {
        this.vacancyRequestsService = vacancyRequestsService;
    }
    list(tenant, query) {
        return this.vacancyRequestsService.list(tenant.companyId, query);
    }
    getById(tenant, id) {
        return this.vacancyRequestsService.getById(tenant.companyId, id);
    }
    create(tenant, dto) {
        return this.vacancyRequestsService.create(tenant, dto);
    }
    update(tenant, id, dto) {
        return this.vacancyRequestsService.update(tenant, id, dto);
    }
    submit(tenant, id) {
        return this.vacancyRequestsService.submit(tenant, id);
    }
    approve(tenant, id, dto) {
        return this.vacancyRequestsService.approve(tenant, id, dto);
    }
    reject(tenant, id, dto) {
        return this.vacancyRequestsService.reject(tenant, id, dto);
    }
};
exports.VacancyRequestsController = VacancyRequestsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vacancy_request_dto_1.ListVacancyRequestsQueryDto]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.request'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vacancy_request_dto_1.CreateVacancyRequestDto]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.request'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vacancy_request_dto_1.UpdateVacancyRequestDto]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.request'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.approve'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vacancy_request_dto_1.ApprovalDecisionDto]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.vacancy.approve'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vacancy_request_dto_1.RejectDecisionDto]),
    __metadata("design:returntype", void 0)
], VacancyRequestsController.prototype, "reject", null);
exports.VacancyRequestsController = VacancyRequestsController = __decorate([
    (0, common_1.Controller)('ats/vacancy-requests'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, company_context_guard_1.CompanyContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [vacancy_requests_service_1.VacancyRequestsService])
], VacancyRequestsController);
//# sourceMappingURL=vacancy-requests.controller.js.map