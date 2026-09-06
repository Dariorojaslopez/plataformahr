import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PreHireDocumentKind } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { CreateHiringDto } from './dto/hiring.dto';
import { UpdatePreHireDto } from './dto/prehire.dto';
import { HirePdiService } from './hire-pdi.service';
import { HiringService } from './hiring.service';
import {
  PREHIRE_FIELD_NAME,
  PREHIRE_MAX_BYTES,
} from './prehire.constants';
import { PreHireService } from './prehire.service';

@Controller('ats/applications')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ApplicationHiringController {
  constructor(
    private readonly hiringService: HiringService,
    private readonly preHireService: PreHireService,
    private readonly hirePdiService: HirePdiService,
  ) {}

  @Get(':applicationId/prehire')
  @RequirePermissions('ats.hiring.read')
  getPreHire(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.preHireService.get(tenant.companyId, applicationId);
  }

  @Patch(':applicationId/prehire')
  @RequirePermissions('ats.hiring.manage')
  updatePreHire(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdatePreHireDto,
  ) {
    return this.preHireService.update(
      tenant.companyId,
      user.userId,
      applicationId,
      dto,
    );
  }

  @Post(':applicationId/prehire/documents')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions('ats.hiring.manage')
  @UseInterceptors(
    FileInterceptor(PREHIRE_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: PREHIRE_MAX_BYTES, files: 1 },
    }),
  )
  uploadPreHireDocument(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body('kind', new ParseEnumPipe(PreHireDocumentKind))
    kind: PreHireDocumentKind,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.preHireService.uploadDocument(
      tenant.companyId,
      user.userId,
      applicationId,
      kind,
      file,
    );
  }

  @Get(':applicationId/prehire/documents/:kind')
  @RequirePermissions('ats.hiring.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadPreHireDocument(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('kind', new ParseEnumPipe(PreHireDocumentKind))
    kind: PreHireDocumentKind,
  ): Promise<StreamableFile> {
    const doc = await this.preHireService.readDocument(
      tenant.companyId,
      applicationId,
      kind,
    );
    const filename = doc.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(doc.buffer, {
      type: doc.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':applicationId/hiring')
  @RequirePermissions('ats.hiring.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.hiringService.getByApplication(tenant.companyId, applicationId);
  }

  @Get(':applicationId/pdi')
  @RequirePermissions('ats.hiring.read')
  getPdi(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.hirePdiService.getDraft(tenant.companyId, applicationId);
  }

  @Get(':applicationId/pdi/download')
  @RequirePermissions('ats.hiring.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadPdi(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<StreamableFile> {
    const file = await this.hirePdiService.downloadText(
      tenant.companyId,
      applicationId,
    );
    const filename = file.filename.replace(/["\r\n]/g, '');
    return new StreamableFile(Buffer.from(file.text, 'utf8'), {
      type: 'text/plain; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':applicationId/pdi/sync')
  @RequirePermissions('ats.hiring.manage')
  syncPdi(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.hirePdiService.syncFromApplication(
      tenant.companyId,
      user.userId,
      applicationId,
    );
  }

  @Post(':applicationId/hire')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
