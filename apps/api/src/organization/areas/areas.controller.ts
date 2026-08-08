import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';

@Controller('organization/areas')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @RequirePermissions('organization.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.areasService.list(tenant.companyId);
  }

  @Get('tree')
  @RequirePermissions('organization.read')
  tree(@CurrentTenant() tenant: TenantContext) {
    return this.areasService.tree(tenant.companyId);
  }

  @Post()
  @RequirePermissions('organization.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAreaDto,
  ) {
    return this.areasService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.areasService.update(tenant.companyId, user.userId, id, dto);
  }
}
