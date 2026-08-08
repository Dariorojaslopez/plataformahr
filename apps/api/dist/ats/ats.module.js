"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const audit_module_1 = require("../core/audit/audit.module");
const rbac_module_1 = require("../core/rbac/rbac.module");
const organization_integrity_service_1 = require("../organization/organization-integrity.service");
const permission_guard_1 = require("../rbac/guards/permission.guard");
const company_context_guard_1 = require("../tenant/guards/company-context.guard");
const applications_controller_1 = require("./applications/applications.controller");
const applications_service_1 = require("./applications/applications.service");
const candidates_controller_1 = require("./candidates/candidates.controller");
const candidates_service_1 = require("./candidates/candidates.service");
const application_interviews_controller_1 = require("./interviews/application-interviews.controller");
const interview_form_templates_controller_1 = require("./interviews/interview-form-templates.controller");
const interviews_controller_1 = require("./interviews/interviews.controller");
const interviews_service_1 = require("./interviews/interviews.service");
const pipeline_controller_1 = require("./pipeline/pipeline.controller");
const vacancy_requests_controller_1 = require("./vacancy-requests/vacancy-requests.controller");
const vacancy_requests_service_1 = require("./vacancy-requests/vacancy-requests.service");
const vacancies_controller_1 = require("./vacancies/vacancies.controller");
const vacancies_service_1 = require("./vacancies/vacancies.service");
let AtsModule = class AtsModule {
};
exports.AtsModule = AtsModule;
exports.AtsModule = AtsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, rbac_module_1.RbacModule, audit_module_1.AuditModule],
        controllers: [
            vacancy_requests_controller_1.VacancyRequestsController,
            vacancies_controller_1.VacanciesController,
            pipeline_controller_1.PipelineController,
            candidates_controller_1.CandidatesController,
            applications_controller_1.ApplicationsController,
            application_interviews_controller_1.ApplicationInterviewsController,
            interviews_controller_1.InterviewsController,
            interview_form_templates_controller_1.InterviewFormTemplatesController,
        ],
        providers: [
            company_context_guard_1.CompanyContextGuard,
            permission_guard_1.PermissionGuard,
            organization_integrity_service_1.OrganizationIntegrityService,
            vacancy_requests_service_1.VacancyRequestsService,
            vacancies_service_1.VacanciesService,
            candidates_service_1.CandidatesService,
            applications_service_1.ApplicationsService,
            interviews_service_1.InterviewsService,
        ],
    })
], AtsModule);
//# sourceMappingURL=ats.module.js.map