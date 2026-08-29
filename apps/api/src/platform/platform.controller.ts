import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from '../core/users/users.service';
import { PlatformOwnerOnly } from './decorators/platform-owner-only.decorator';
import { PlatformOwnerGuard } from './guards/platform-owner.guard';
import { PlatformService } from './platform.service';
import {
  CreatePlatformCompanyDto,
  ResetPlatformCompanyAdminPasswordDto,
  UpdatePlatformCompanyStatusDto,
  UpdatePlatformCompanyFeaturesDto,
} from './dto/platform-company.dto';
import {
  UpdatePlatformCompanyBillingDto,
  UpdatePlatformCompanyPremiumDto,
} from './dto/platform-billing.dto';
import {
  CreatePlatformOwnerDto,
  UpdatePlatformOwnerDto,
} from './dto/platform-owner.dto';

@Controller('platform')
export class PlatformController {
  constructor(
    private readonly usersService: UsersService,
    private readonly platformService: PlatformService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  async me(@CurrentUser() authUser: AuthenticatedUser) {
    const user = await this.usersService.findById(authUser.userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformOwner: user.isPlatformOwner,
    };
  }

  /** Catalog of ACTIVE companies for Platform Owner tenant entry. */
  @Get('companies')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  listCompanies() {
    return this.platformService.listActiveCompanies();
  }

  @Get('admin/billing')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  listBilling() {
    return this.platformService.listBilling();
  }

  @Get('admin/companies')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  listManagedCompanies() {
    return this.platformService.listManagedCompanies();
  }

  @Post('admin/companies')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlatformCompanyDto,
  ) {
    return this.platformService.createCompany(user.userId, dto);
  }

  @Get('admin/companies/:id/features')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  getCompanyFeatures(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformService.getCompanyFeatures(id);
  }

  @Put('admin/companies/:id/features')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  updateCompanyFeatures(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformCompanyFeaturesDto,
  ) {
    return this.platformService.updateCompanyFeatures(user.userId, id, dto);
  }

  @Put('admin/companies/:id/premium')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  updateCompanyPremium(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformCompanyPremiumDto,
  ) {
    return this.platformService.updateCompanyPremium(user.userId, id, dto);
  }

  @Put('admin/companies/:id/billing')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  updateCompanyBilling(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformCompanyBillingDto,
  ) {
    return this.platformService.updateCompanyBilling(user.userId, id, dto);
  }

  @Patch('admin/companies/:id/status')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  updateCompanyStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformCompanyStatusDto,
  ) {
    return this.platformService.updateStatus(user.userId, id, dto);
  }

  @Post('admin/companies/:id/initial-admin/reset-password')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  resetCompanyAdminPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPlatformCompanyAdminPasswordDto,
  ) {
    return this.platformService.resetCompanyAdminPassword(user.userId, id, dto);
  }

  @Post('admin/companies/:id/access')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  grantTenantAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformService.grantTenantAdminAccess(user.userId, id);
  }

  @Get('admin/owners')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  listPlatformOwners() {
    return this.platformService.listPlatformOwners();
  }

  @Post('admin/owners')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  createPlatformOwner(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlatformOwnerDto,
  ) {
    return this.platformService.createPlatformOwner(user.userId, dto);
  }

  @Patch('admin/owners/:id')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  updatePlatformOwner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformOwnerDto,
  ) {
    return this.platformService.updatePlatformOwner(user.userId, id, dto);
  }

  @Post('admin/owners/:id/reset-password')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  resetPlatformOwnerPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformService.resetPlatformOwnerPassword(user.userId, id);
  }
}
