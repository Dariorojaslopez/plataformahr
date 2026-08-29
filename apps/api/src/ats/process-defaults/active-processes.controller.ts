import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ReplacePositionOccupantStepsDto } from './dto/position-occupant-step.dto';
import { ActiveProcessesService } from './active-processes.service';

@Controller('ats/active-processes')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ActiveProcessesController {
  constructor(private readonly processes: ActiveProcessesService) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.processes.list(tenant.companyId);
  }

  @Get(':id/approvals')
  @RequirePermissions('ats.vacancy.read')
  getApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processes.getApprovals(tenant.companyId, id);
  }

  @Put(':id/approvals')
  @RequirePermissions('ats.vacancy.manage')
  updateApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePositionOccupantStepsDto,
  ) {
    return this.processes.updateApprovals(tenant, id, dto);
  }

  @Get(':id/evaluators')
  @RequirePermissions('ats.vacancy.read')
  getEvaluators(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processes.getEvaluators(tenant.companyId, id);
  }

  @Put(':id/evaluators')
  @RequirePermissions('ats.vacancy.manage')
  updateEvaluators(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePositionOccupantStepsDto,
  ) {
    return this.processes.updateEvaluators(tenant, id, dto);
  }
}
