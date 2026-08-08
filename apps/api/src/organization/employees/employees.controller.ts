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
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import { EmployeesService } from './employees.service';
import { CreateReportingLineDto } from '../reporting-lines/dto/reporting-line.dto';
import { ReportingLinesService } from '../reporting-lines/reporting-lines.service';

@Controller('organization/employees')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly reportingLinesService: ReportingLinesService,
  ) {}

  @Get()
  @RequirePermissions('organization.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListEmployeesQueryDto,
  ) {
    return this.employeesService.list(tenant.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('organization.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.getById(tenant.companyId, id);
  }

  @Get(':id/organization-profile')
  @RequirePermissions('organization.read')
  organizationProfile(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.getOrganizationProfile(tenant.companyId, id);
  }

  @Get(':id/reporting-lines')
  @RequirePermissions('organization.read')
  listReportingLines(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportingLinesService.listForEmployee(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('organization.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(tenant.companyId, user.userId, id, dto);
  }

  @Post(':id/reporting-lines')
  @RequirePermissions('organization.manage')
  createReportingLine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReportingLineDto,
  ) {
    return this.reportingLinesService.create(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Delete(':id/reporting-lines/:reportingLineId')
  @RequirePermissions('organization.manage')
  async removeReportingLine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reportingLineId', ParseUUIDPipe) reportingLineId: string,
  ) {
    await this.reportingLinesService.remove(
      tenant.companyId,
      user.userId,
      id,
      reportingLineId,
    );
    return { success: true };
  }
}
