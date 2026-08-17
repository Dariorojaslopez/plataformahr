import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type {
  AuthenticatedUser,
  TenantContext,
} from '../../../auth/auth.types';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../../tenant/guards/company-context.guard';
import { LOGO_FIELD_NAME, LOGO_MAX_BYTES } from './branding.constants';
import { BrandingService } from './branding.service';
import { UpdateCompanyBrandingDto } from './dto/update-company-branding.dto';

@Controller('companies/current/branding')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @RequirePermissions('company.read')
  get(@CurrentTenant() tenant: TenantContext) {
    return this.branding.getBranding(tenant.companyId);
  }

  @Patch()
  @RequirePermissions('company.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanyBrandingDto,
  ) {
    return this.branding.updateBranding(tenant.companyId, user.userId, dto);
  }

  @Get('logo')
  @RequirePermissions('company.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getLogo(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<StreamableFile> {
    const logo = await this.branding.readLogo(tenant.companyId);
    return new StreamableFile(logo.buffer, {
      type: logo.mimeType,
      disposition: 'inline',
    });
  }

  @Post('logo')
  @RequirePermissions('company.manage')
  @UseInterceptors(
    FileInterceptor(LOGO_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: LOGO_MAX_BYTES, files: 1 },
    }),
  )
  uploadLogo(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.branding.replaceLogo(tenant.companyId, user.userId, file);
  }

  @Delete('logo')
  @RequirePermissions('company.manage')
  removeLogo(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branding.removeLogo(tenant.companyId, user.userId);
  }
}
