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
import { CompetenciesService } from './competencies.service';
import {
  CreateCompetencyDto,
  ListCompetenciesQueryDto,
  UpdateCompetencyDto,
} from './dto/competency.dto';

@Controller('performance/competencies')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class CompetenciesController {
  constructor(private readonly competenciesService: CompetenciesService) {}

  @Get()
  @RequirePermissions('performance.competency.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListCompetenciesQueryDto,
  ) {
    return this.competenciesService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('performance.competency.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.competenciesService.getById(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('performance.competency.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompetencyDto,
  ) {
    return this.competenciesService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('performance.competency.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetencyDto,
  ) {
    return this.competenciesService.update(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
