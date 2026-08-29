import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { TenantContext } from '../../auth/auth.types';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { CompaniesService } from './companies.service';
import { UpdateCompanyPerformanceSettingsDto } from './dto/performance-settings.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  @UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
  @RequirePermissions('company.read')
  async getCurrent(@CurrentTenant() tenant: TenantContext) {
    const company = await this.companiesService.findById(tenant.companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.companiesService.toCurrentResponse(company);
  }

  @Patch('current/performance-settings')
  @UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
  @RequirePermissions('company.manage')
  updatePerformanceSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateCompanyPerformanceSettingsDto,
  ) {
    return this.companiesService.updatePerformanceSettings(tenant.companyId, dto);
  }

  @Get('current/features')
  @UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
  @RequirePermissions('company.read')
  getCurrentFeatures(@CurrentTenant() tenant: TenantContext) {
    return this.companiesService.getCurrentAccessContext(tenant);
  }
}
