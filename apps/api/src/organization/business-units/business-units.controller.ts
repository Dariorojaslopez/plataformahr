import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { BusinessUnitsService } from './business-units.service';
import {
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from './dto/business-unit.dto';

@Controller('organization/business-units')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class BusinessUnitsController {
  constructor(private readonly businessUnitsService: BusinessUnitsService) {}

  @Get()
  @RequirePermissions('organization.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.businessUnitsService.list(tenant.companyId);
  }

  @Post()
  @RequirePermissions('organization.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessUnitDto,
  ) {
    return this.businessUnitsService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessUnitDto,
  ) {
    return this.businessUnitsService.update(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
