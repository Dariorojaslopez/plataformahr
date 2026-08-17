import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../core/audit/audit.module';
import { CompaniesModule } from '../core/companies/companies.module';
import { RbacModule } from '../core/rbac/rbac.module';
import { OrganizationIntegrityService } from '../organization/organization-integrity.service';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { CompanyContextGuard } from '../tenant/guards/company-context.guard';
import { ApplicationsController } from './applications/applications.controller';
import { ApplicationsService } from './applications/applications.service';
import { CandidatesController } from './candidates/candidates.controller';
import { CandidatesService } from './candidates/candidates.service';
import { ApplicationInterviewsController } from './interviews/application-interviews.controller';
import { InterviewFormTemplatesController } from './interviews/interview-form-templates.controller';
import { InterviewsController } from './interviews/interviews.controller';
import { InterviewsService } from './interviews/interviews.service';
import { ApplicationOffersController } from './offers/application-offers.controller';
import { OffersController } from './offers/offers.controller';
import { OffersService } from './offers/offers.service';
import { ApplicationHiringController } from './hiring/application-hiring.controller';
import { HiringService } from './hiring/hiring.service';
import { PipelineController } from './pipeline/pipeline.controller';
import { VacancyRequestsController } from './vacancy-requests/vacancy-requests.controller';
import { VacancyRequestsService } from './vacancy-requests/vacancy-requests.service';
import { VacancyApprovalWorkflowController } from './vacancy-requests/vacancy-approval-workflow.controller';
import { VacancyApprovalWorkflowService } from './vacancy-requests/vacancy-approval-workflow.service';
import { VacanciesController } from './vacancies/vacancies.controller';
import { VacanciesService } from './vacancies/vacancies.service';
import { PublicJobsController } from './public-jobs/public-jobs.controller';
import { PublicJobsService } from './public-jobs/public-jobs.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule, CompaniesModule],
  controllers: [
    VacancyRequestsController,
    VacancyApprovalWorkflowController,
    VacanciesController,
    PipelineController,
    CandidatesController,
    ApplicationsController,
    ApplicationInterviewsController,
    ApplicationOffersController,
    ApplicationHiringController,
    InterviewsController,
    InterviewFormTemplatesController,
    OffersController,
    PublicJobsController,
  ],
  providers: [
    CompanyContextGuard,
    PermissionGuard,
    OrganizationIntegrityService,
    VacancyRequestsService,
    VacancyApprovalWorkflowService,
    VacanciesService,
    CandidatesService,
    ApplicationsService,
    InterviewsService,
    OffersService,
    HiringService,
    PublicJobsService,
  ],
})
export class AtsModule {}
