import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ListPositionOccupantsQueryDto } from './dto/position-occupants.dto';
import { PositionOccupantsService } from './position-occupants.service';

@Controller('ats/position-occupants')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class PositionOccupantsController {
  constructor(private readonly occupants: PositionOccupantsService) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListPositionOccupantsQueryDto,
  ) {
    return this.occupants.list(tenant.companyId, query.positionId);
  }
}
