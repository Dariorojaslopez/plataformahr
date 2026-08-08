"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("./audit/audit.module");
const companies_module_1 = require("./companies/companies.module");
const memberships_module_1 = require("./memberships/memberships.module");
const rbac_module_1 = require("./rbac/rbac.module");
const users_module_1 = require("./users/users.module");
let CoreModule = class CoreModule {
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Module)({
        imports: [
            users_module_1.UsersModule,
            companies_module_1.CompaniesModule,
            memberships_module_1.MembershipsModule,
            rbac_module_1.RbacModule,
            audit_module_1.AuditModule,
        ],
        exports: [
            users_module_1.UsersModule,
            companies_module_1.CompaniesModule,
            memberships_module_1.MembershipsModule,
            rbac_module_1.RbacModule,
            audit_module_1.AuditModule,
        ],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map