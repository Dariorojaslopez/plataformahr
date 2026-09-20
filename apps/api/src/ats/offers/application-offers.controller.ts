import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { CreateJobOfferDto } from './dto/offer.dto';
import {
  CONTRACT_FIELD_NAME,
  CONTRACT_MAX_BYTES,
} from './contract.constants';
import {
  OFFER_LETTER_FIELD_NAME,
  OFFER_LETTER_MAX_BYTES,
} from './offer-letter.constants';
import { ContractService } from './contract.service';
import { OfferLetterService } from './offer-letter.service';
import { OffersService } from './offers.service';

@Controller('ats/applications')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ApplicationOffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly offerLetter: OfferLetterService,
    private readonly contract: ContractService,
  ) {}

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

  @Post(':applicationId/signed-offer-letter')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions('ats.offer.manage')
  @UseInterceptors(
    FileInterceptor(OFFER_LETTER_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: OFFER_LETTER_MAX_BYTES, files: 1 },
    }),
  )
  uploadSignedLetter(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.offerLetter.uploadSignedForApplication(
      tenant.companyId,
      user.userId,
      applicationId,
      file,
    );
  }

  @Get(':applicationId/signed-offer-letter')
  @RequirePermissions('ats.offer.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadSignedLetter(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<StreamableFile> {
    const file = await this.offerLetter.downloadSignedForApplication(
      tenant.companyId,
      applicationId,
    );
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':applicationId/signed-contract')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions('ats.offer.manage')
  @UseInterceptors(
    FileInterceptor(CONTRACT_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: CONTRACT_MAX_BYTES, files: 1 },
    }),
  )
  uploadSignedContract(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.contract.uploadSignedForApplication(
      tenant.companyId,
      user.userId,
      applicationId,
      file,
    );
  }

  @Get(':applicationId/signed-contract')
  @RequirePermissions('ats.offer.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadSignedContract(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<StreamableFile> {
    const file = await this.contract.downloadSignedForApplication(
      tenant.companyId,
      applicationId,
    );
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
