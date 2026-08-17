import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { CreateJobLevelDto, UpdateJobLevelDto } from './dto/job-level.dto';
import { ReplaceJobLevelCompetenciesDto } from './dto/job-level-competency.dto';
import { JobLevelCompetenciesService } from './job-level-competencies.service';
import { JobLevelsService } from './job-levels.service';

@Controller('organization/job-levels')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class JobLevelsController {
  constructor(
    private readonly jobLevelsService: JobLevelsService,
    private readonly jobLevelCompetenciesService: JobLevelCompetenciesService,
  ) {}

  @Get()
  @RequirePermissions('organization.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.jobLevelsService.list(tenant.companyId);
  }

  @Post()
  @RequirePermissions('organization.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJobLevelDto,
  ) {
    return this.jobLevelsService.create(tenant.companyId, user.userId, dto);
  }

  @Get(':id/competencies')
  @RequirePermissions('organization.read')
  listCompetencies(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobLevelCompetenciesService.list(tenant.companyId, id);
  }

  @Put(':id/competencies')
  @RequirePermissions('organization.manage')
  replaceCompetencies(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceJobLevelCompetenciesDto,
  ) {
    return this.jobLevelCompetenciesService.replace(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobLevelDto,
  ) {
    return this.jobLevelsService.update(tenant.companyId, user.userId, id, dto);
  }
}
