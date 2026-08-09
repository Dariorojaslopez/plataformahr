import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { GoalCompletionService } from '../completion/completion.service';
import {
  ApproveCompletionDto,
  CreateCompletionRequestDto,
  ListCompletionRequestsQueryDto,
  RejectCompletionDto,
} from '../completion/dto/completion.dto';
import {
  CreateCheckInDto,
  ListCheckInsQueryDto,
} from '../progress/dto/check-in.dto';
import { GoalProgressService } from '../progress/progress.service';
import {
  CreateAssignmentDto,
  CreateGoalDto,
  CreateKeyResultDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
  UpdateKeyResultDto,
} from './dto/goal.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly progressService: GoalProgressService,
    private readonly completionService: GoalCompletionService,
  ) {}

  @Get('mine')
  @RequirePermissions('goals.goal.read')
  listMine(@CurrentTenant() tenant: TenantContext) {
    return this.goalsService.listMine(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
    );
  }

  @Get('team')
  @RequirePermissions('goals.goal.read')
  listTeam(@CurrentTenant() tenant: TenantContext) {
    return this.progressService.listTeam(tenant.companyId, tenant.userId);
  }

  @Get('completion-requests')
  @RequirePermissions('goals.completion.review')
  listCompletionReviews(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListCompletionRequestsQueryDto,
  ) {
    return this.completionService.listPendingReviews(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      query,
    );
  }

  @Post('completion-requests/:requestId/approve')
  @RequirePermissions('goals.completion.review')
  approveCompletion(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ApproveCompletionDto,
  ) {
    return this.completionService.approve(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      requestId,
      dto,
    );
  }

  @Post('completion-requests/:requestId/reject')
  @RequirePermissions('goals.completion.review')
  rejectCompletion(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectCompletionDto,
  ) {
    return this.completionService.reject(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      requestId,
      dto,
    );
  }

  @Get()
  @RequirePermissions('goals.goal.manage')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListGoalsQueryDto,
  ) {
    return this.goalsService.list(tenant.companyId, query);
  }

  @Post()
  @RequirePermissions('goals.goal.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goalsService.create(tenant.companyId, user.userId, dto);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.getById(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      id,
    );
  }

  @Patch(':id')
  @RequirePermissions('goals.goal.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(tenant.companyId, user.userId, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('goals.goal.manage')
  activate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.activate(tenant.companyId, user.userId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('goals.goal.manage')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.cancel(tenant.companyId, user.userId, id);
  }

  @Post(':id/completion-requests')
  @RequirePermissions('goals.completion.request')
  requestCompletion(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCompletionRequestDto,
  ) {
    return this.completionService.requestCompletion(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
      dto,
    );
  }

  @Get(':id/completion-requests')
  @RequirePermissions('goals.goal.read')
  listGoalCompletionRequests(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.completionService.listForGoal(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      id,
    );
  }

  @Get(':id/result')
  @RequirePermissions('goals.goal.read')
  getResult(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.completionService.getResult(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      id,
    );
  }

  @Get(':id/progress')
  @RequirePermissions('goals.goal.read')
  getProgress(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.progressService.getGoalProgress(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      id,
    );
  }

  @Get(':goalId/key-results/:keyResultId/check-ins')
  @RequirePermissions('goals.goal.read')
  listCheckIns(
    @CurrentTenant() tenant: TenantContext,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Param('keyResultId', ParseUUIDPipe) keyResultId: string,
    @Query() query: ListCheckInsQueryDto,
  ) {
    return this.progressService.listCheckIns(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      goalId,
      keyResultId,
      query,
    );
  }

  @Post(':goalId/key-results/:keyResultId/check-ins')
  @RequirePermissions('goals.progress.update')
  createCheckIn(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Param('keyResultId', ParseUUIDPipe) keyResultId: string,
    @Body() dto: CreateCheckInDto,
  ) {
    return this.progressService.createCheckIn(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      goalId,
      keyResultId,
      dto,
    );
  }

  @Get(':id/key-results')
  @RequirePermissions('goals.goal.manage')
  listKeyResults(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.listKeyResults(tenant.companyId, id);
  }

  @Post(':id/key-results')
  @RequirePermissions('goals.goal.manage')
  createKeyResult(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateKeyResultDto,
  ) {
    return this.goalsService.createKeyResult(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Patch(':id/key-results/:krId')
  @RequirePermissions('goals.goal.manage')
  updateKeyResult(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('krId', ParseUUIDPipe) krId: string,
    @Body() dto: UpdateKeyResultDto,
  ) {
    return this.goalsService.updateKeyResult(
      tenant.companyId,
      user.userId,
      id,
      krId,
      dto,
    );
  }

  @Delete(':id/key-results/:krId')
  @RequirePermissions('goals.goal.manage')
  deleteKeyResult(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.goalsService.deleteKeyResult(
      tenant.companyId,
      user.userId,
      id,
      krId,
    );
  }

  @Get(':id/assignments')
  @RequirePermissions('goals.goal.manage')
  listAssignments(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.listAssignments(tenant.companyId, id);
  }

  @Post(':id/assignments')
  @RequirePermissions('goals.goal.assign')
  addAssignment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.goalsService.addAssignment(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Delete(':id/assignments/:assignmentId')
  @RequirePermissions('goals.goal.assign')
  removeAssignment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.goalsService.removeAssignment(
      tenant.companyId,
      user.userId,
      id,
      assignmentId,
    );
  }
}
