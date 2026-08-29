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
import { ListVacanciesQueryDto, UpdateVacancyDto } from './dto/vacancy.dto';
import { VacanciesService } from './vacancies.service';
import { PublicJobsService } from '../public-jobs/public-jobs.service';

@Controller('ats/vacancies')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class VacanciesController {
  constructor(
    private readonly vacanciesService: VacanciesService,
    private readonly publicJobs: PublicJobsService,
  ) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListVacanciesQueryDto,
  ) {
    return this.vacanciesService.list(tenant, query);
  }

  @Get('recruiters')
  @RequirePermissions('ats.vacancy.read')
  listRecruiters(@CurrentTenant() tenant: TenantContext) {
    return this.vacanciesService.listRecruiters(tenant.companyId);
  }

  @Get(':id/public-preview')
  @RequirePermissions('ats.vacancy.read')
  async publicPreview(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.vacanciesService.requireVisibleVacancy(tenant, id);
    return this.publicJobs.preview(tenant.companyId, id);
  }

  @Get(':id')
  @RequirePermissions('ats.vacancy.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacanciesService.getById(tenant, id);
  }

  @Patch(':id')
  @RequirePermissions('ats.vacancy.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVacancyDto,
  ) {
    return this.vacanciesService.update(tenant, user.userId, id, dto);
  }

  @Post(':id/publish')
  @RequirePermissions('ats.vacancy.manage')
  publish(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacanciesService.publish(tenant, user.userId, id);
  }

  @Post(':id/unpublish')
  @RequirePermissions('ats.vacancy.manage')
  unpublish(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacanciesService.unpublish(tenant, user.userId, id);
  }
}
