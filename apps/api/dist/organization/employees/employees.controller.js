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
exports.EmployeesController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const require_permissions_decorator_1 = require("../../rbac/decorators/require-permissions.decorator");
const permission_guard_1 = require("../../rbac/guards/permission.guard");
const current_tenant_decorator_1 = require("../../tenant/decorators/current-tenant.decorator");
const company_context_guard_1 = require("../../tenant/guards/company-context.guard");
const employee_dto_1 = require("./dto/employee.dto");
const employees_service_1 = require("./employees.service");
const reporting_line_dto_1 = require("../reporting-lines/dto/reporting-line.dto");
const reporting_lines_service_1 = require("../reporting-lines/reporting-lines.service");
let EmployeesController = class EmployeesController {
    employeesService;
    reportingLinesService;
    constructor(employeesService, reportingLinesService) {
        this.employeesService = employeesService;
        this.reportingLinesService = reportingLinesService;
    }
    list(tenant, query) {
        return this.employeesService.list(tenant.companyId, query);
    }
    getById(tenant, id) {
        return this.employeesService.getById(tenant.companyId, id);
    }
    organizationProfile(tenant, id) {
        return this.employeesService.getOrganizationProfile(tenant.companyId, id);
    }
    listReportingLines(tenant, id) {
        return this.reportingLinesService.listForEmployee(tenant.companyId, id);
    }
    create(tenant, user, dto) {
        return this.employeesService.create(tenant.companyId, user.userId, dto);
    }
    update(tenant, user, id, dto) {
        return this.employeesService.update(tenant.companyId, user.userId, id, dto);
    }
    createReportingLine(tenant, user, id, dto) {
        return this.reportingLinesService.create(tenant.companyId, user.userId, id, dto);
    }
    async removeReportingLine(tenant, user, id, reportingLineId) {
        await this.reportingLinesService.remove(tenant.companyId, user.userId, id, reportingLineId);
        return { success: true };
    }
};
exports.EmployeesController = EmployeesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, employee_dto_1.ListEmployeesQueryDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/organization-profile'),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "organizationProfile", null);
__decorate([
    (0, common_1.Get)(':id/reporting-lines'),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.read'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "listReportingLines", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, employee_dto_1.CreateEmployeeDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, employee_dto_1.UpdateEmployeeDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/reporting-lines'),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, reporting_line_dto_1.CreateReportingLineDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "createReportingLine", null);
__decorate([
    (0, common_1.Delete)(':id/reporting-lines/:reportingLineId'),
    (0, require_permissions_decorator_1.RequirePermissions)('organization.manage'),
    __param(0, (0, current_tenant_decorator_1.CurrentTenant)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Param)('reportingLineId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "removeReportingLine", null);
exports.EmployeesController = EmployeesController = __decorate([
    (0, common_1.Controller)('organization/employees'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, company_context_guard_1.CompanyContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [employees_service_1.EmployeesService,
        reporting_lines_service_1.ReportingLinesService])
], EmployeesController);
//# sourceMappingURL=employees.controller.js.map