import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { TenantContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../tenant/guards/company-context.guard';
import {
  InternalJobApplicationDto,
  UpdateHomeCompanyInfoDto,
  UpdateHomeProfileDto,
} from './dto/home.dto';
import {
  HOME_INFO_FIELD_NAME,
  HOME_INFO_VIDEO_MAX_BYTES,
} from './home-info.constants';
import { HomeInfoService } from './home-info.service';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class HomeController {
  constructor(
    private readonly home: HomeService,
    private readonly homeInfo: HomeInfoService,
  ) {}

  @Get()
  @RequirePermissions('company.read')
  getFeed(@CurrentTenant() tenant: TenantContext) {
    return this.home.getFeed(tenant);
  }

  @Patch('profile')
  @RequirePermissions('company.read')
  updateProfile(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateHomeProfileDto,
  ) {
    return this.home.updateProfile(tenant, dto);
  }

  @Get('company-info')
  @RequirePermissions('company.read')
  getCompanyInfo(@CurrentTenant() tenant: TenantContext) {
    return this.homeInfo.getCompanyInfo(tenant);
  }

  @Patch('company-info')
  @RequirePermissions('company.manage')
  updateCompanyInfo(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateHomeCompanyInfoDto,
  ) {
    return this.homeInfo.updateCompanyInfo(tenant, dto);
  }

  @Get('company-info/media')
  @RequirePermissions('company.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getCompanyInfoMedia(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<StreamableFile> {
    const media = await this.homeInfo.readMedia(tenant);
    return new StreamableFile(media.buffer, {
      type: media.mimeType,
      disposition: 'inline',
    });
  }

  @Post('company-info/media')
  @RequirePermissions('company.manage')
  @UseInterceptors(
    FileInterceptor(HOME_INFO_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: HOME_INFO_VIDEO_MAX_BYTES, files: 1 },
    }),
  )
  uploadCompanyInfoMedia(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.homeInfo.replaceMedia(tenant, file);
  }

  @Delete('company-info/media')
  @RequirePermissions('company.manage')
  removeCompanyInfoMedia(@CurrentTenant() tenant: TenantContext) {
    return this.homeInfo.removeMedia(tenant);
  }

  @Post('vacancies/:id/apply')
  @RequirePermissions('company.read')
  apply(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalJobApplicationDto,
  ) {
    return this.home.applyToVacancy(tenant, id, dto);
  }
}
