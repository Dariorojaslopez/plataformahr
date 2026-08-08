import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ApplicationsService } from '../applications/applications.service';

@Controller('ats/vacancies')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class PipelineController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get(':vacancyId/pipeline')
  @RequirePermissions('ats.application.read')
  pipeline(
    @CurrentTenant() tenant: TenantContext,
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
  ) {
    return this.applicationsService.pipeline(tenant.companyId, vacancyId);
  }
}
