import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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
import {
  ATS_TEMPLATE_ERRORS,
  ATS_TEMPLATE_FIELD_NAME,
  ATS_TEMPLATE_KIND,
  ATS_TEMPLATE_MAX_BYTES,
  type AtsTemplateKind,
} from './ats-templates.constants';
import { AtsTemplatesService } from './ats-templates.service';

@Controller('companies/current/ats-templates')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class AtsTemplatesController {
  constructor(private readonly templates: AtsTemplatesService) {}

  @Get(':kind')
  @RequirePermissions('ats.vacancy.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @CurrentTenant() tenant: TenantContext,
    @Param('kind') kindParam: string,
  ): Promise<StreamableFile> {
    const kind = this.parseKind(kindParam);
    const file = await this.templates.read(tenant.companyId, kind);
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':kind')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions('ats.vacancy.manage')
  @UseInterceptors(
    FileInterceptor(ATS_TEMPLATE_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: ATS_TEMPLATE_MAX_BYTES, files: 1 },
    }),
  )
  upload(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kindParam: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const kind = this.parseKind(kindParam);
    return this.templates.upload(tenant.companyId, user.userId, kind, file);
  }

  @Delete(':kind')
  @RequirePermissions('ats.vacancy.manage')
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kindParam: string,
  ) {
    const kind = this.parseKind(kindParam);
    return this.templates.remove(tenant.companyId, user.userId, kind);
  }

  private parseKind(raw: string): AtsTemplateKind {
    if (
      raw === ATS_TEMPLATE_KIND.OFFER_LETTER ||
      raw === ATS_TEMPLATE_KIND.CONTRACT
    ) {
      return raw;
    }
    throw new BadRequestException(ATS_TEMPLATE_ERRORS.INVALID_KIND);
  }
}
