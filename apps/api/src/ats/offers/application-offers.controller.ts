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
import { CreateJobOfferDto } from './dto/offer.dto';
import { OffersService } from './offers.service';

@Controller('ats/applications')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ApplicationOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get(':applicationId/offer')
  @RequirePermissions('ats.offer.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.offersService.getByApplication(tenant.companyId, applicationId);
  }

  @Post(':applicationId/offer')
  @RequirePermissions('ats.offer.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateJobOfferDto,
  ) {
    return this.offersService.create(
      tenant.companyId,
      user.userId,
      applicationId,
      dto,
    );
  }
}
