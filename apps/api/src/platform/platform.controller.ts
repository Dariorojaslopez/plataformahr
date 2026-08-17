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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from '../core/users/users.service';
import { PlatformOwnerOnly } from './decorators/platform-owner-only.decorator';
import { PlatformOwnerGuard } from './guards/platform-owner.guard';
import { PlatformService } from './platform.service';
import {
  CreatePlatformCompanyDto,
  UpdatePlatformCompanyStatusDto,
} from './dto/platform-company.dto';

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

  @Post('admin/companies/:id/access')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  grantTenantAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformService.grantTenantAdminAccess(user.userId, id);
  }
}
