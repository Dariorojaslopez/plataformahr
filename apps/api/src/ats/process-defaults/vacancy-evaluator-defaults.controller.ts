import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ReplacePositionOccupantStepsDto } from './dto/position-occupant-step.dto';
import { VacancyEvaluatorDefaultsService } from './vacancy-evaluator-defaults.service';

@Controller('ats/evaluator-defaults')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class VacancyEvaluatorDefaultsController {
  constructor(
    private readonly defaults: VacancyEvaluatorDefaultsService,
  ) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  get(@CurrentTenant() tenant: TenantContext) {
    return this.defaults.get(tenant.companyId);
  }

  @Put()
  @RequirePermissions('ats.vacancy.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ReplacePositionOccupantStepsDto,
  ) {
    return this.defaults.update(tenant, dto);
  }
}
