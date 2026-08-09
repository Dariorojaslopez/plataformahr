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
import { GoalCyclesService } from './cycles.service';
import {
  CreateGoalCycleDto,
  ListGoalCyclesQueryDto,
  UpdateGoalCycleDto,
} from './dto/cycle.dto';

@Controller('goals/cycles')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class GoalCyclesController {
  constructor(private readonly cyclesService: GoalCyclesService) {}

  @Get()
  @RequirePermissions('goals.cycle.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListGoalCyclesQueryDto,
  ) {
    return this.cyclesService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('goals.cycle.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.getById(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('goals.cycle.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalCycleDto,
  ) {
    return this.cyclesService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('goals.cycle.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalCycleDto,
  ) {
    return this.cyclesService.update(tenant.companyId, user.userId, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('goals.cycle.manage')
  activate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.activate(tenant.companyId, user.userId, id);
  }

  @Post(':id/close')
  @RequirePermissions('goals.cycle.manage')
  close(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.close(tenant.companyId, user.userId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('goals.cycle.manage')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cyclesService.cancel(tenant.companyId, user.userId, id);
  }
}
