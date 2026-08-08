import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import {
  CreateTranscriptSegmentDto,
  UpdateInterviewDto,
  UpdateTranscriptSegmentDto,
  UpsertInterviewAnswerDto,
} from './dto/interview.dto';
import { InterviewsService } from './interviews.service';

@Controller('ats/interviews')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get(':id')
  @RequirePermissions('ats.interview.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.getById(tenant.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('ats.interview.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Post(':id/start')
  @RequirePermissions('ats.interview.manage')
  start(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.start(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
    );
  }

  @Post(':id/complete')
  @RequirePermissions('ats.interview.manage')
  complete(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.complete(tenant.companyId, user.userId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('ats.interview.manage')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.cancel(tenant.companyId, user.userId, id);
  }

  @Put(':id/questions/:questionId/answer')
  @RequirePermissions('ats.interview.evaluate')
  upsertAnswer(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpsertInterviewAnswerDto,
  ) {
    return this.interviewsService.upsertAnswer(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
      questionId,
      dto,
    );
  }

  @Get(':id/transcript')
  @RequirePermissions('ats.interview.transcribe')
  getTranscript(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.getTranscript(tenant.companyId, id);
  }

  @Post(':id/transcript/segments')
  @RequirePermissions('ats.interview.transcribe')
  addSegment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTranscriptSegmentDto,
  ) {
    return this.interviewsService.addTranscriptSegment(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
      dto,
    );
  }

  @Patch(':id/transcript/segments/:segmentId')
  @RequirePermissions('ats.interview.transcribe')
  updateSegment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Body() dto: UpdateTranscriptSegmentDto,
  ) {
    return this.interviewsService.updateTranscriptSegment(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
      segmentId,
      dto,
    );
  }

  @Delete(':id/transcript/segments/:segmentId')
  @RequirePermissions('ats.interview.transcribe')
  deleteSegment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
  ) {
    return this.interviewsService.deleteTranscriptSegment(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
      segmentId,
    );
  }
}
