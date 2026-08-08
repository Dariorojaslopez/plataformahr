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
exports.InterviewFormTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const require_permissions_decorator_1 = require("../../rbac/decorators/require-permissions.decorator");
const permission_guard_1 = require("../../rbac/guards/permission.guard");
const current_tenant_decorator_1 = require("../../tenant/decorators/current-tenant.decorator");
const company_context_guard_1 = require("../../tenant/guards/company-context.guard");
const interview_dto_1 = require("./dto/interview.dto");
const interviews_service_1 = require("./interviews.service");
let InterviewFormTemplatesController = class InterviewFormTemplatesController {
    interviewsService;
    constructor(interviewsService) {
        this.interviewsService = interviewsService;
    }
    list(tenant) {
        return this.interviewsService.listTemplates(tenant.companyId);
    }
    getById(tenant, id) {
        return this.interviewsService.getTemplate(tenant.companyId, id);
    }
    create(tenant, user, dto) {
        return this.interviewsService.createTemplate(tenant.companyId, user.userId, dto);
    }
    update(tenant, user, id, dto) {
        return this.interviewsService.updateTemplate(tenant.companyId, user.userId, id, dto);
    }
    addQuestion(tenant, user, id, dto) {
        return this.interviewsService.addTemplateQuestion(tenant.companyId, user.userId, id, dto);
    }
};
exports.InterviewFormTemplatesController = InterviewFormTemplatesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InterviewFormTemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InterviewFormTemplatesController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, interview_dto_1.CreateInterviewFormTemplateDto]),
    __metadata("design:returntype", void 0)
], InterviewFormTemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, interview_dto_1.UpdateInterviewFormTemplateDto]),
    __metadata("design:returntype", void 0)
], InterviewFormTemplatesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/questions'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, interview_dto_1.AddTemplateQuestionDto]),
    __metadata("design:returntype", void 0)
], InterviewFormTemplatesController.prototype, "addQuestion", null);
exports.InterviewFormTemplatesController = InterviewFormTemplatesController = __decorate([
    (0, common_1.Controller)('ats/interview-form-templates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, company_context_guard_1.CompanyContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [interviews_service_1.InterviewsService])
], InterviewFormTemplatesController);
//# sourceMappingURL=interview-form-templates.controller.js.map