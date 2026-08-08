"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const audit_module_1 = require("../core/audit/audit.module");
const rbac_module_1 = require("../core/rbac/rbac.module");
const permission_guard_1 = require("../rbac/guards/permission.guard");
const company_context_guard_1 = require("../tenant/guards/company-context.guard");
const areas_controller_1 = require("./areas/areas.controller");
const areas_service_1 = require("./areas/areas.service");
const business_units_controller_1 = require("./business-units/business-units.controller");
const business_units_service_1 = require("./business-units/business-units.service");
const employees_controller_1 = require("./employees/employees.controller");
const employees_service_1 = require("./employees/employees.service");
const job_levels_controller_1 = require("./job-levels/job-levels.controller");
const job_levels_service_1 = require("./job-levels/job-levels.service");
const organization_integrity_service_1 = require("./organization-integrity.service");
const positions_controller_1 = require("./positions/positions.controller");
const positions_service_1 = require("./positions/positions.service");
const reporting_lines_service_1 = require("./reporting-lines/reporting-lines.service");
let OrganizationModule = class OrganizationModule {
};
exports.OrganizationModule = OrganizationModule;
exports.OrganizationModule = OrganizationModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, rbac_module_1.RbacModule, audit_module_1.AuditModule],
        controllers: [
            business_units_controller_1.BusinessUnitsController,
            areas_controller_1.AreasController,
            job_levels_controller_1.JobLevelsController,
            positions_controller_1.PositionsController,
            employees_controller_1.EmployeesController,
        ],
        providers: [
            company_context_guard_1.CompanyContextGuard,
            permission_guard_1.PermissionGuard,
            organization_integrity_service_1.OrganizationIntegrityService,
            business_units_service_1.BusinessUnitsService,
            areas_service_1.AreasService,
            job_levels_service_1.JobLevelsService,
            positions_service_1.PositionsService,
            employees_service_1.EmployeesService,
            reporting_lines_service_1.ReportingLinesService,
        ],
    })
], OrganizationModule);
//# sourceMappingURL=organization.module.js.map