import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ClosingService } from '../closing/closing.service';
import { SaveClosingSessionDto } from '../closing/dto/closing.dto';
import { GoalApprovalsService } from '../goal-approvals/goal-approvals.service';
import { PerformanceInboxService } from '../inbox/inbox.service';
import {
  ReviewCommentDto,
  SaveGoalDefinitionDto,
} from './dto/goal-definition.dto';
import { GoalDefinitionService } from './goal-definition.service';

@Controller('performance/my-evaluations')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class GoalDefinitionController {
  constructor(
    private readonly goalDefinition: GoalDefinitionService,
    private readonly approvals: GoalApprovalsService,
    private readonly inbox: PerformanceInboxService,
    private readonly closing: ClosingService,
  ) {}

  @Get('notifications')
  notifications(@CurrentTenant() tenant: TenantContext) {
    return this.inbox.list(tenant.companyId, tenant.userId);
  }

  @Post('notifications/:id/read')
  markRead(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inbox.markRead(tenant.companyId, tenant.userId, id);
  }

  @Get(':cycleId/goal-definition')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.goalDefinition.get(tenant.companyId, tenant.userId, cycleId);
  }

  @Put(':cycleId/goal-definition')
  save(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: SaveGoalDefinitionDto,
  ) {
    return this.goalDefinition.save(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Post(':cycleId/goal-definition/submit')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  submit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: SaveGoalDefinitionDto,
  ) {
    return this.goalDefinition.submit(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Post(':cycleId/goal-definition/edit-request')
  requestEdit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.approvals.requestEdit(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Get(':cycleId/goal-approvals')
  listApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.approvals.list(tenant.companyId, tenant.userId, cycleId);
  }

  @Get(':cycleId/goal-approvals/:employeeId')
  getApproval(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.approvals.get(
      tenant.companyId,
      tenant.userId,
      cycleId,
      employeeId,
    );
  }

  @Post(':cycleId/goal-approvals/:employeeId/approve')
  approve(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.approvals.approve(
      tenant.companyId,
      user.userId,
      cycleId,
      employeeId,
      dto,
    );
  }

  @Post(':cycleId/goal-approvals/:employeeId/reject')
  reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.approvals.reject(
      tenant.companyId,
      user.userId,
      cycleId,
      employeeId,
      dto,
    );
  }

  @Post(':cycleId/edit-requests/:requestId/approve')
  approveEdit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.approvals.reviewEditRequest(
      tenant.companyId,
      user.userId,
      cycleId,
      requestId,
      true,
      dto,
    );
  }

  @Post(':cycleId/edit-requests/:requestId/reject')
  rejectEdit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.approvals.reviewEditRequest(
      tenant.companyId,
      user.userId,
      cycleId,
      requestId,
      false,
      dto,
    );
  }

  @Get(':cycleId/closing')
  getClosing(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.closing.get(
      tenant.companyId,
      tenant.userId,
      cycleId,
      employeeId,
    );
  }

  @Put(':cycleId/closing')
  saveClosing(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: SaveClosingSessionDto,
  ) {
    return this.closing.save(tenant.companyId, user.userId, cycleId, dto);
  }

  @Post(':cycleId/closing/accept')
  acceptClosing(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.closing.accept(tenant.companyId, user.userId, cycleId);
  }
}
