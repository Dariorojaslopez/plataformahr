import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../core/audit/audit.module';
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
import { PipelineController } from './pipeline/pipeline.controller';
import { VacancyRequestsController } from './vacancy-requests/vacancy-requests.controller';
import { VacancyRequestsService } from './vacancy-requests/vacancy-requests.service';
import { VacanciesController } from './vacancies/vacancies.controller';
import { VacanciesService } from './vacancies/vacancies.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule],
  controllers: [
    VacancyRequestsController,
    VacanciesController,
    PipelineController,
    CandidatesController,
    ApplicationsController,
    ApplicationInterviewsController,
    ApplicationOffersController,
    InterviewsController,
    InterviewFormTemplatesController,
    OffersController,
  ],
  providers: [
    CompanyContextGuard,
    PermissionGuard,
    OrganizationIntegrityService,
    VacancyRequestsService,
    VacanciesService,
    CandidatesService,
    ApplicationsService,
    InterviewsService,
    OffersService,
  ],
})
export class AtsModule {}
