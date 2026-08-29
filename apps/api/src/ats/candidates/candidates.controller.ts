import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ApplicationsService } from '../applications/applications.service';
import { CreateApplicationForCandidateDto } from '../applications/dto/application.dto';
import {
  CreateCandidateDto,
  ListCandidatesQueryDto,
  UpdateCandidateDto,
} from './dto/candidate.dto';
import { CandidatesService } from './candidates.service';

@Controller('ats/candidates')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Get()
  @RequirePermissions('ats.candidate.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListCandidatesQueryDto,
  ) {
    return this.candidatesService.list(tenant.companyId, query);
  }

  @Get(':id/cv')
  @RequirePermissions('ats.candidate.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadCv(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const cv = await this.candidatesService.readCv(tenant.companyId, id);
    const filename = cv.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(cv.buffer, {
      type: cv.mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':id')
  @RequirePermissions('ats.candidate.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.candidatesService.getById(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('ats.candidate.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.candidatesService.create(tenant.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('ats.candidate.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.candidatesService.update(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Post(':candidateId/applications')
  @RequirePermissions('ats.application.manage')
  createApplication(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: CreateApplicationForCandidateDto,
  ) {
    return this.applicationsService.create(tenant.companyId, user.userId, {
      candidateId,
      vacancyId: dto.vacancyId,
    });
  }
}
