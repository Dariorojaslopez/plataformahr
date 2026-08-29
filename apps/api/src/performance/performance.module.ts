import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../core/audit/audit.module';
import { RbacModule } from '../core/rbac/rbac.module';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { CompanyContextGuard } from '../tenant/guards/company-context.guard';
import { AnalyticsService } from './analytics/analytics.service';
import { CalibrationController } from './calibration/calibration.controller';
import { CalibrationService } from './calibration/calibration.service';
import { ClosingService } from './closing/closing.service';
import { CompetenciesController } from './competencies/competencies.controller';
import { CompetenciesService } from './competencies/competencies.service';
import { CyclesController } from './cycles/cycles.controller';
import { CyclesService } from './cycles/cycles.service';
import { EvaluationsController } from './evaluations/evaluations.controller';
import { EvaluationsService } from './evaluations/evaluations.service';
import { GoalApprovalsService } from './goal-approvals/goal-approvals.service';
import { GoalDefinitionController } from './goal-definition/goal-definition.controller';
import { GoalDefinitionService } from './goal-definition/goal-definition.service';
import { PerformanceInboxService } from './inbox/inbox.service';
import { ParticipantsController } from './participants/participants.controller';
import { ParticipantsService } from './participants/participants.service';
import { ResultsController } from './results/results.controller';
import { ResultsService } from './results/results.service';
import { ScalesController } from './scales/scales.controller';
import { ScalesService } from './scales/scales.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule],
  controllers: [
    CyclesController,
    CompetenciesController,
    ScalesController,
    ParticipantsController,
    EvaluationsController,
    GoalDefinitionController,
    ResultsController,
    CalibrationController,
  ],
  providers: [
    CompanyContextGuard,
    PermissionGuard,
    CyclesService,
    CompetenciesService,
    ScalesService,
    ParticipantsService,
    EvaluationsService,
    GoalDefinitionService,
    GoalApprovalsService,
    PerformanceInboxService,
    ClosingService,
    ResultsService,
    AnalyticsService,
    CalibrationService,
  ],
})
export class PerformanceModule {}
