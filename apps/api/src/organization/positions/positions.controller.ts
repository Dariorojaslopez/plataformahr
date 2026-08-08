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
import { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
import { PositionsService } from './positions.service';

@Controller('organization/positions')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @RequirePermissions('organization.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.positionsService.list(tenant.companyId);
  }

  @Get(':id')
  @RequirePermissions('organization.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.positionsService.getById(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('organization.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePositionDto,
  ) {
    return this.positionsService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.positionsService.update(tenant.companyId, user.userId, id, dto);
  }
}
