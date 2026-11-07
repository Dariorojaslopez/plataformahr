import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  AssignParticipantDto,
  BulkAssignParticipantsDto,
  ListParticipantsQueryDto,
} from './dto/participant.dto';
import {
  ReassignLeaderDto,
  ResetParticipantPhaseDto,
  UnlockGoalsDto,
} from './dto/flow-controls.dto';
import { FlowControlsService } from './flow-controls.service';
import { ParticipantsService } from './participants.service';

@Controller('performance/cycles/:cycleId/participants')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ParticipantsController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly flowControls: FlowControlsService,
  ) {}

  @Get()
  @RequirePermissions('performance.evaluation.manage')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Query() query: ListParticipantsQueryDto,
  ) {
    return this.participantsService.list(tenant.companyId, cycleId, query);
  }

  @Get(':participantId')
  @RequirePermissions('performance.evaluation.manage')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.participantsService.getById(
      tenant.companyId,
      cycleId,
      participantId,
    );
  }

  @Post('phase-reset')
  @RequirePermissions('performance.evaluation.manage')
  resetPhase(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: ResetParticipantPhaseDto,
  ) {
    return this.flowControls.resetPhase(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Post('reassign-leader')
  @RequirePermissions('performance.evaluation.manage')
  reassignLeader(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: ReassignLeaderDto,
  ) {
    return this.flowControls.reassignLeader(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Get(':participantId/goals')
  @RequirePermissions('performance.evaluation.manage')
  listGoals(
    @CurrentTenant() tenant: TenantContext,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.flowControls.listGoals(
      tenant.companyId,
      cycleId,
      participantId,
    );
  }

  @Post(':participantId/goal-unlocks')
  @RequirePermissions('performance.evaluation.manage')
  unlockGoals(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UnlockGoalsDto,
  ) {
    return this.flowControls.unlockGoals(
      tenant.companyId,
      user.userId,
      cycleId,
      participantId,
      dto,
    );
  }

  @Post('bulk')
  @RequirePermissions('performance.evaluation.manage')
  bulkAssign(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: BulkAssignParticipantsDto,
  ) {
    return this.participantsService.bulkAssign(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Post()
  @RequirePermissions('performance.evaluation.manage')
  assign(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: AssignParticipantDto,
  ) {
    return this.participantsService.assign(
      tenant.companyId,
      user.userId,
      cycleId,
      dto,
    );
  }

  @Delete(':participantId')
  @RequirePermissions('performance.evaluation.manage')
  removeDraft(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.participantsService.removeDraft(
      tenant.companyId,
      user.userId,
      cycleId,
      participantId,
    );
  }

  @Post(':participantId/exclude')
  @RequirePermissions('performance.evaluation.manage')
  exclude(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.participantsService.exclude(
      tenant.companyId,
      user.userId,
      cycleId,
      participantId,
    );
  }
}
