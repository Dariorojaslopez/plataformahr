import {
  Body,
  Controller,
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
import { CalibrationService } from './calibration.service';
import {
  CreateCalibrationSessionDto,
  SaveCalibrationPlacementDto,
  UpdateCalibrationSessionDto,
} from './dto/calibration.dto';

@Controller('performance/calibration')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class CalibrationController {
  constructor(private readonly calibration: CalibrationService) {}

  @Get('config')
  @RequirePermissions('performance.cycle.read')
  getConfig(@CurrentTenant() tenant: TenantContext) {
    return this.calibration.getConfig(tenant.companyId);
  }

  @Get('sessions')
  @RequirePermissions('performance.cycle.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.calibration.list(tenant.companyId);
  }

  @Post('sessions')
  @RequirePermissions('performance.cycle.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCalibrationSessionDto,
  ) {
    return this.calibration.create(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      dto,
    );
  }

  @Get('sessions/:id')
  @RequirePermissions('performance.cycle.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calibration.getById(tenant.companyId, id);
  }

  @Patch('sessions/:id')
  @RequirePermissions('performance.cycle.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalibrationSessionDto,
  ) {
    return this.calibration.update(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
      dto,
    );
  }

  @Get('sessions/:id/placements')
  @RequirePermissions('performance.cycle.read')
  listPlacements(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.calibration.listPlacements(
      tenant.companyId,
      id,
      cycleId,
    );
  }

  @Post('sessions/:id/placements')
  @RequirePermissions('performance.cycle.read')
  savePlacement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveCalibrationPlacementDto,
  ) {
    return this.calibration.savePlacement(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
