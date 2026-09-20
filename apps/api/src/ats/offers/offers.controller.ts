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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { DecideContractApprovalDto } from './dto/contract-approval.dto';
import { UpdateJobOfferDto } from './dto/offer.dto';
import { ContractApprovalsService } from './contract-approvals.service';
import { ContractService } from './contract.service';
import { OfferLetterApprovalsService } from './offer-letter-approvals.service';
import {
  CONTRACT_FIELD_NAME,
  CONTRACT_MAX_BYTES,
} from './contract.constants';
import {
  OFFER_LETTER_FIELD_NAME,
  OFFER_LETTER_MAX_BYTES,
} from './offer-letter.constants';
import { OfferLetterService } from './offer-letter.service';
import { OffersService } from './offers.service';

@Controller('ats/offers')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly contractApprovals: ContractApprovalsService,
    private readonly offerLetter: OfferLetterService,
    private readonly offerLetterApprovals: OfferLetterApprovalsService,
    private readonly contract: ContractService,
  ) {}

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

  @Get(':id/letter')
  @RequirePermissions('ats.offer.read')
  getLetterStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offerLetter.getLetterStatus(tenant.companyId, id);
  }

  @Get(':id/letter-template')
  @RequirePermissions('ats.offer.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadLetterTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const file = await this.offerLetter.downloadTemplate(tenant.companyId, id);
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':id/signed-letter')
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
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.offerLetter.uploadSigned(
      tenant.companyId,
      user.userId,
      id,
      file,
    );
  }

  @Get(':id/signed-letter')
  @RequirePermissions('ats.offer.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadSignedLetter(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const file = await this.offerLetter.downloadSigned(tenant.companyId, id);
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Delete(':id/signed-letter')
  @RequirePermissions('ats.offer.manage')
  removeSignedLetter(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offerLetter.removeSigned(tenant.companyId, user.userId, id);
  }

  @Get(':id/contract')
  @RequirePermissions('ats.offer.read')
  getContractStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contract.getStatus(tenant.companyId, id);
  }

  @Get(':id/contract-template')
  @RequirePermissions('ats.offer.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadContractTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const file = await this.contract.downloadTemplate(tenant.companyId, id);
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':id/signed-contract')
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
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.contract.uploadSigned(
      tenant.companyId,
      user.userId,
      id,
      file,
    );
  }

  @Get(':id/signed-contract')
  @RequirePermissions('ats.offer.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadSignedContract(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const file = await this.contract.downloadSigned(tenant.companyId, id);
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':id/contract-approvals')
  @RequirePermissions('ats.offer.read')
  getContractApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contractApprovals.getByOffer(tenant.companyId, id);
  }

  @Post(':id/contract-approvals/:stepId/approve')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('ats.offer.read')
  approveContractStep(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: DecideContractApprovalDto,
  ) {
    return this.contractApprovals.decide(
      tenant.companyId,
      user.userId,
      id,
      stepId,
      'APPROVE',
      dto.comment,
    );
  }

  @Post(':id/contract-approvals/:stepId/reject')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('ats.offer.read')
  rejectContractStep(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: DecideContractApprovalDto,
  ) {
    return this.contractApprovals.decide(
      tenant.companyId,
      user.userId,
      id,
      stepId,
      'REJECT',
      dto.comment,
    );
  }

  @Get(':id/offer-letter-approvals')
  @RequirePermissions('ats.offer.read')
  getOfferLetterApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offerLetterApprovals.getByOffer(tenant.companyId, id);
  }

  @Post(':id/offer-letter-approvals/:stepId/approve')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('ats.offer.read')
  approveOfferLetterStep(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: DecideContractApprovalDto,
  ) {
    return this.offerLetterApprovals.decide(
      tenant.companyId,
      user.userId,
      id,
      stepId,
      'APPROVE',
      dto.comment,
    );
  }

  @Post(':id/offer-letter-approvals/:stepId/reject')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('ats.offer.read')
  rejectOfferLetterStep(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: DecideContractApprovalDto,
  ) {
    return this.offerLetterApprovals.decide(
      tenant.companyId,
      user.userId,
      id,
      stepId,
      'REJECT',
      dto.comment,
    );
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
