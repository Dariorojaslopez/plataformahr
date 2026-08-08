import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateHiringDto } from './dto/hiring.dto';
import { HiringService } from './hiring.service';

@Controller('ats/applications')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ApplicationHiringController {
  constructor(private readonly hiringService: HiringService) {}

  @Get(':applicationId/hiring')
  @RequirePermissions('ats.hiring.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.hiringService.getByApplication(tenant.companyId, applicationId);
  }

  @Post(':applicationId/hire')
  @RequirePermissions('ats.hiring.manage')
  hire(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateHiringDto,
  ) {
    return this.hiringService.hire(
      tenant.companyId,
      user.userId,
      applicationId,
      dto,
    );
  }
}
