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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { UpdateJobOfferDto } from './dto/offer.dto';
import { OffersService } from './offers.service';

@Controller('ats/offers')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get(':id')
  @RequirePermissions('ats.offer.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offersService.getById(tenant.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('ats.offer.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobOfferDto,
  ) {
    return this.offersService.update(tenant.companyId, user.userId, id, dto);
  }

  @Post(':id/send')
  @RequirePermissions('ats.offer.manage')
  send(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offersService.send(tenant.companyId, user.userId, id);
  }

  @Post(':id/accept')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('ats.offer.respond')
  accept(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offersService.accept(tenant.companyId, user.userId, id);
  }

  @Post(':id/reject')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('ats.offer.respond')
  reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offersService.reject(tenant.companyId, user.userId, id);
  }

  @Post(':id/withdraw')
  @RequirePermissions('ats.offer.manage')
  withdraw(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offersService.withdraw(tenant.companyId, user.userId, id);
  }
}
