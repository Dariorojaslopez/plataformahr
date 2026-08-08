import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../core/audit/audit.module';
import { RbacModule } from '../core/rbac/rbac.module';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { CompanyContextGuard } from '../tenant/guards/company-context.guard';
import { AreasController } from './areas/areas.controller';
import { AreasService } from './areas/areas.service';
import { BusinessUnitsController } from './business-units/business-units.controller';
import { BusinessUnitsService } from './business-units/business-units.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { JobLevelsController } from './job-levels/job-levels.controller';
import { JobLevelsService } from './job-levels/job-levels.service';
import { OrganizationIntegrityService } from './organization-integrity.service';
import { PositionsController } from './positions/positions.controller';
import { PositionsService } from './positions/positions.service';
import { ReportingLinesService } from './reporting-lines/reporting-lines.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule],
  controllers: [
    BusinessUnitsController,
    AreasController,
    JobLevelsController,
    PositionsController,
    EmployeesController,
  ],
  providers: [
    CompanyContextGuard,
    PermissionGuard,
    OrganizationIntegrityService,
    BusinessUnitsService,
    AreasService,
    JobLevelsService,
    PositionsService,
    EmployeesService,
    ReportingLinesService,
  ],
})
export class OrganizationModule {}
