import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import {
  CreateCompetencyScaleDto,
  CreateScaleLevelDto,
  ListScalesQueryDto,
  UpdateCompetencyScaleDto,
  UpdateScaleLevelDto,
} from './dto/scale.dto';
import { ScalesService } from './scales.service';

@Controller('performance/scales')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ScalesController {
  constructor(private readonly scalesService: ScalesService) {}

  @Get()
  @RequirePermissions('performance.scale.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListScalesQueryDto,
  ) {
    return this.scalesService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('performance.scale.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scalesService.getById(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('performance.scale.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompetencyScaleDto,
  ) {
    return this.scalesService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('performance.scale.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetencyScaleDto,
  ) {
    return this.scalesService.update(tenant.companyId, user.userId, id, dto);
  }

  @Post(':id/levels')
  @RequirePermissions('performance.scale.manage')
  addLevel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateScaleLevelDto,
  ) {
    return this.scalesService.addLevel(tenant.companyId, user.userId, id, dto);
  }

  @Patch(':id/levels/:levelId')
  @RequirePermissions('performance.scale.manage')
  updateLevel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('levelId', ParseUUIDPipe) levelId: string,
    @Body() dto: UpdateScaleLevelDto,
  ) {
    return this.scalesService.updateLevel(
      tenant.companyId,
      user.userId,
      id,
      levelId,
      dto,
    );
  }

  @Delete(':id/levels/:levelId')
  @RequirePermissions('performance.scale.manage')
  removeLevel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('levelId', ParseUUIDPipe) levelId: string,
  ) {
    return this.scalesService.removeLevel(
      tenant.companyId,
      user.userId,
      id,
      levelId,
    );
  }
}
