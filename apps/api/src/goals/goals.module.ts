import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../core/audit/audit.module';
import { RbacModule } from '../core/rbac/rbac.module';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { CompanyContextGuard } from '../tenant/guards/company-context.guard';
import { GoalCompletionService } from './completion/completion.service';
import { GoalCyclesController } from './cycles/cycles.controller';
import { GoalCyclesService } from './cycles/cycles.service';
import { GoalsController } from './goals/goals.controller';
import { GoalsService } from './goals/goals.service';
import { GoalProgressService } from './progress/progress.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule],
  controllers: [GoalCyclesController, GoalsController],
  providers: [
    CompanyContextGuard,
    PermissionGuard,
    GoalCyclesService,
    GoalsService,
    GoalProgressService,
    GoalCompletionService,
  ],
})
export class GoalsModule {}
