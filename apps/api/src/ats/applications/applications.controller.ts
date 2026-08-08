import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CreateApplicationDto,
  ListApplicationsQueryDto,
  MoveApplicationDto,
} from './dto/application.dto';
import { ApplicationsService } from './applications.service';

@Controller('ats/applications')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @RequirePermissions('ats.application.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListApplicationsQueryDto,
  ) {
    return this.applicationsService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('ats.application.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getById(tenant.companyId, id);
  }

  @Get(':id/history')
  @RequirePermissions('ats.application.read')
  history(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.history(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('ats.application.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(tenant.companyId, user.userId, dto);
  }

  @Post(':id/move')
  @RequirePermissions('ats.application.manage')
  move(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveApplicationDto,
  ) {
    return this.applicationsService.move(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
