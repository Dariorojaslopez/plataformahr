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
import type { TenantContext } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import {
  ApprovalDecisionDto,
  CreateVacancyRequestDto,
  ListVacancyRequestsQueryDto,
  RejectDecisionDto,
  UpdateVacancyRequestDto,
} from './dto/vacancy-request.dto';
import { VacancyRequestsService } from './vacancy-requests.service';

@Controller('ats/vacancy-requests')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class VacancyRequestsController {
  constructor(
    private readonly vacancyRequestsService: VacancyRequestsService,
  ) {}

  @Get()
  @RequirePermissions('ats.vacancy.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListVacancyRequestsQueryDto,
  ) {
    return this.vacancyRequestsService.list(tenant, query);
  }

  @Get(':id')
  @RequirePermissions('ats.vacancy.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacancyRequestsService.getById(tenant, id);
  }

  @Post()
  @RequirePermissions('ats.vacancy.request')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateVacancyRequestDto,
  ) {
    return this.vacancyRequestsService.create(tenant, dto);
  }

  @Patch(':id')
  @RequirePermissions('ats.vacancy.request')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVacancyRequestDto,
  ) {
    return this.vacancyRequestsService.update(tenant, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions('ats.vacancy.request')
  submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacancyRequestsService.submit(tenant, id);
  }

  @Post(':id/approve')
  @RequirePermissions('ats.vacancy.approve')
  approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDecisionDto,
  ) {
    return this.vacancyRequestsService.approve(tenant, id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions('ats.vacancy.approve')
  reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDecisionDto,
  ) {
    return this.vacancyRequestsService.reject(tenant, id, dto);
  }
}
