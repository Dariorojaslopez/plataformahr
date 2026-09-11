import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { TenantContext } from '../../../auth/auth.types';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../../tenant/guards/company-context.guard';
import { UpdateRoleMenusDto } from './dto/update-role-menu.dto';
import { RoleMenuService } from './role-menu.service';

@Controller('companies/current/role-menus')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class RoleMenuController {
  constructor(private readonly roleMenus: RoleMenuService) {}

  @Get()
  @RequirePermissions('company.manage')
  get(@CurrentTenant() tenant: TenantContext) {
    return this.roleMenus.getConfig(tenant.companyId);
  }

  @Put()
  @RequirePermissions('company.manage')
  replace(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateRoleMenusDto,
  ) {
    return this.roleMenus.replaceAll(tenant, dto);
  }
}
