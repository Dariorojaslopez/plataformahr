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
import { AnalyticsService } from '../analytics/analytics.service';
import { CyclesService } from './cycles.service';
import {
  AddCycleCompetencyDto,
  CreatePerformanceCycleDto,
  ListPerformanceCyclesQueryDto,
  UpdateCycleCompetencyDto,
  UpdatePerformanceCycleDto,
} from './dto/cycle.dto';

@Controller('performance/cycles')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class CyclesController {
  constructor(
    private readonly cyclesService: CyclesService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get()
  @RequirePermissions('performance.cycle.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListPerformanceCyclesQueryDto,
  ) {
    return this.cyclesService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('performance.cycle.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.getById(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('performance.cycle.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePerformanceCycleDto,
  ) {
    return this.cyclesService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('performance.cycle.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePerformanceCycleDto,
  ) {
    return this.cyclesService.update(tenant.companyId, user.userId, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('performance.cycle.manage')
  activate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.activate(tenant.companyId, user.userId, id);
  }

  @Post(':id/close')
  @RequirePermissions('performance.cycle.manage')
  close(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.close(tenant.companyId, user.userId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('performance.cycle.manage')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.cancel(tenant.companyId, user.userId, id);
  }

  @Get(':id/analytics')
  @RequirePermissions('performance.analytics.read')
  getAnalytics(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analyticsService.getCycleAnalytics(tenant.companyId, id);
  }

  @Get(':id/competencies')
  @RequirePermissions('performance.cycle.read')
  listCompetencies(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.listCompetencies(tenant.companyId, id);
  }

  @Post(':id/competencies')
  @RequirePermissions('performance.cycle.manage')
  addCompetency(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCycleCompetencyDto,
  ) {
    return this.cyclesService.addCompetency(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Patch(':id/competencies/:competencyId')
  @RequirePermissions('performance.cycle.manage')
  updateCompetency(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('competencyId', ParseUUIDPipe) competencyId: string,
    @Body() dto: UpdateCycleCompetencyDto,
  ) {
    return this.cyclesService.updateCompetency(
      tenant.companyId,
      user.userId,
      id,
      competencyId,
      dto,
    );
  }

  @Delete(':id/competencies/:competencyId')
  @RequirePermissions('performance.cycle.manage')
  removeCompetency(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('competencyId', ParseUUIDPipe) competencyId: string,
  ) {
    return this.cyclesService.removeCompetency(
      tenant.companyId,
      user.userId,
      id,
      competencyId,
    );
  }
}
