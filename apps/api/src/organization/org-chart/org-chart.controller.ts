import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { OrgChartQueryDto } from './dto/org-chart-query.dto';
import { OrgChartService } from './org-chart.service';

@Controller('organization/org-chart')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  @Get()
  @RequirePermissions('organization.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OrgChartQueryDto,
  ) {
    return this.orgChartService.get(
      tenant.companyId,
      query.includeInactive === true,
    );
  }
}
