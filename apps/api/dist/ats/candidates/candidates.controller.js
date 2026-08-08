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
exports.CandidatesController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const require_permissions_decorator_1 = require("../../rbac/decorators/require-permissions.decorator");
const permission_guard_1 = require("../../rbac/guards/permission.guard");
const current_tenant_decorator_1 = require("../../tenant/decorators/current-tenant.decorator");
const company_context_guard_1 = require("../../tenant/guards/company-context.guard");
const applications_service_1 = require("../applications/applications.service");
const application_dto_1 = require("../applications/dto/application.dto");
const candidate_dto_1 = require("./dto/candidate.dto");
const candidates_service_1 = require("./candidates.service");
let CandidatesController = class CandidatesController {
    candidatesService;
    applicationsService;
    constructor(candidatesService, applicationsService) {
        this.candidatesService = candidatesService;
        this.applicationsService = applicationsService;
    }
    list(tenant, query) {
        return this.candidatesService.list(tenant.companyId, query);
    }
    getById(tenant, id) {
        return this.candidatesService.getById(tenant.companyId, id);
    }
    create(tenant, user, dto) {
        return this.candidatesService.create(tenant.companyId, user.userId, dto);
    }
    update(tenant, user, id, dto) {
        return this.candidatesService.update(tenant.companyId, user.userId, id, dto);
    }
    createApplication(tenant, user, candidateId, dto) {
        return this.applicationsService.create(tenant.companyId, user.userId, {
            candidateId,
            vacancyId: dto.vacancyId,
        });
    }
};
exports.CandidatesController = CandidatesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.candidate.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, candidate_dto_1.ListCandidatesQueryDto]),
    __metadata("design:returntype", void 0)
], CandidatesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.candidate.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CandidatesController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.candidate.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, candidate_dto_1.CreateCandidateDto]),
    __metadata("design:returntype", void 0)
], CandidatesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.candidate.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, candidate_dto_1.UpdateCandidateDto]),
    __metadata("design:returntype", void 0)
], CandidatesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':candidateId/applications'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.application.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('candidateId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, application_dto_1.CreateApplicationForCandidateDto]),
    __metadata("design:returntype", void 0)
], CandidatesController.prototype, "createApplication", null);
exports.CandidatesController = CandidatesController = __decorate([
    (0, common_1.Controller)('ats/candidates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, company_context_guard_1.CompanyContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [candidates_service_1.CandidatesService,
        applications_service_1.ApplicationsService])
], CandidatesController);
//# sourceMappingURL=candidates.controller.js.map