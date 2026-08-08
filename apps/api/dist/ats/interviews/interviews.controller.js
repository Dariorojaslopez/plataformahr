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
exports.InterviewsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const require_permissions_decorator_1 = require("../../rbac/decorators/require-permissions.decorator");
const permission_guard_1 = require("../../rbac/guards/permission.guard");
const current_tenant_decorator_1 = require("../../tenant/decorators/current-tenant.decorator");
const company_context_guard_1 = require("../../tenant/guards/company-context.guard");
const interview_dto_1 = require("./dto/interview.dto");
const interviews_service_1 = require("./interviews.service");
let InterviewsController = class InterviewsController {
    interviewsService;
    constructor(interviewsService) {
        this.interviewsService = interviewsService;
    }
    getById(tenant, id) {
        return this.interviewsService.getById(tenant.companyId, id);
    }
    update(tenant, user, id, dto) {
        return this.interviewsService.update(tenant.companyId, user.userId, id, dto);
    }
    start(tenant, user, id) {
        return this.interviewsService.start(tenant.companyId, user.userId, tenant.membershipId, id);
    }
    complete(tenant, user, id) {
        return this.interviewsService.complete(tenant.companyId, user.userId, id);
    }
    cancel(tenant, user, id) {
        return this.interviewsService.cancel(tenant.companyId, user.userId, id);
    }
    upsertAnswer(tenant, user, id, questionId, dto) {
        return this.interviewsService.upsertAnswer(tenant.companyId, user.userId, tenant.membershipId, id, questionId, dto);
    }
    getTranscript(tenant, id) {
        return this.interviewsService.getTranscript(tenant.companyId, id);
    }
    addSegment(tenant, user, id, dto) {
        return this.interviewsService.addTranscriptSegment(tenant.companyId, user.userId, tenant.membershipId, id, dto);
    }
    updateSegment(tenant, user, id, segmentId, dto) {
        return this.interviewsService.updateTranscriptSegment(tenant.companyId, user.userId, tenant.membershipId, id, segmentId, dto);
    }
    deleteSegment(tenant, user, id, segmentId) {
        return this.interviewsService.deleteTranscriptSegment(tenant.companyId, user.userId, tenant.membershipId, id, segmentId);
    }
};
exports.InterviewsController = InterviewsController;
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "getById", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, interview_dto_1.UpdateInterviewDto]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Put)(':id/questions/:questionId/answer'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.evaluate'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Param)('questionId', common_1.ParseUUIDPipe)),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, interview_dto_1.UpsertInterviewAnswerDto]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "upsertAnswer", null);
__decorate([
    (0, common_1.Get)(':id/transcript'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.transcribe'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "getTranscript", null);
__decorate([
    (0, common_1.Post)(':id/transcript/segments'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.transcribe'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, interview_dto_1.CreateTranscriptSegmentDto]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "addSegment", null);
__decorate([
    (0, common_1.Patch)(':id/transcript/segments/:segmentId'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.transcribe'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Param)('segmentId', common_1.ParseUUIDPipe)),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, interview_dto_1.UpdateTranscriptSegmentDto]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "updateSegment", null);
__decorate([
    (0, common_1.Delete)(':id/transcript/segments/:segmentId'),
    (0, require_permissions_decorator_1.RequirePermissions)('ats.interview.transcribe'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Param)('segmentId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", void 0)
], InterviewsController.prototype, "deleteSegment", null);
exports.InterviewsController = InterviewsController = __decorate([
    (0, common_1.Controller)('ats/interviews'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, company_context_guard_1.CompanyContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [interviews_service_1.InterviewsService])
], InterviewsController);
//# sourceMappingURL=interviews.controller.js.map