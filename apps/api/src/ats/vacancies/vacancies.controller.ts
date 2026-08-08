import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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

@Controller('ats/vacancies')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class VacanciesController {
  constructor(private readonly vacanciesService: VacanciesService) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListVacanciesQueryDto,
  ) {
    return this.vacanciesService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('ats.vacancy.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacanciesService.getById(tenant.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('ats.vacancy.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVacancyDto,
  ) {
    return this.vacanciesService.update(tenant.companyId, user.userId, id, dto);
  }
}
