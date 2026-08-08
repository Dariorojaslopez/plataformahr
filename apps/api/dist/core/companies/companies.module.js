"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../../auth/auth.module");
const permission_guard_1 = require("../../rbac/guards/permission.guard");
const rbac_module_1 = require("../rbac/rbac.module");
const company_context_guard_1 = require("../../tenant/guards/company-context.guard");
const companies_controller_1 = require("./companies.controller");
const companies_service_1 = require("./companies.service");
let CompaniesModule = class CompaniesModule {
};
exports.CompaniesModule = CompaniesModule;
exports.CompaniesModule = CompaniesModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, rbac_module_1.RbacModule],
        controllers: [companies_controller_1.CompaniesController],
        providers: [companies_service_1.CompaniesService, company_context_guard_1.CompanyContextGuard, permission_guard_1.PermissionGuard],
        exports: [companies_service_1.CompaniesService],
    })
], CompaniesModule);
//# sourceMappingURL=companies.module.js.map