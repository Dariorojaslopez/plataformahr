import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { UpdateVacancyApprovalWorkflowDto } from './dto/vacancy-approval-workflow.dto';
import { VacancyApprovalWorkflowService } from './vacancy-approval-workflow.service';

@Controller('ats/vacancy-approval-workflow')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class VacancyApprovalWorkflowController {
  constructor(
    private readonly workflowService: VacancyApprovalWorkflowService,
  ) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  get(@CurrentTenant() tenant: TenantContext) {
    return this.workflowService.get(tenant.companyId);
  }

  @Put()
  @RequirePermissions('ats.vacancy.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateVacancyApprovalWorkflowDto,
  ) {
    return this.workflowService.update(tenant, dto);
  }
}
