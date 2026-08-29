import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { UpsertEvaluationResponseDto } from './dto/evaluation-response.dto';
import { EvaluationsService } from './evaluations.service';

@Controller('performance/evaluations')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get('mine')
  @RequirePermissions('performance.evaluation.read')
  listMine(@CurrentTenant() tenant: TenantContext) {
    return this.evaluationsService.listMine(tenant.companyId, tenant.userId);
  }

  @Get(':id')
  @RequirePermissions('performance.evaluation.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluationsService.getById(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      id,
    );
  }

  @Put(':evaluationId/competencies/:competencyId/response')
  @RequirePermissions('performance.evaluation.respond')
  upsertResponse(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('competencyId', ParseUUIDPipe) competencyId: string,
    @Body() dto: UpsertEvaluationResponseDto,
  ) {
    return this.evaluationsService.upsertResponse(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      evaluationId,
      competencyId,
      dto,
    );
  }

  @Put(':evaluationId/goals/:goalId/response')
  @RequirePermissions('performance.evaluation.respond')
  upsertGoalRating(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: UpsertEvaluationResponseDto,
  ) {
    return this.evaluationsService.upsertGoalRating(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      evaluationId,
      goalId,
      dto,
    );
  }

  @Post(':id/submit')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @RequirePermissions('performance.evaluation.respond')
  submit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluationsService.submit(
      tenant.companyId,
      user.userId,
      tenant.membershipId,
      id,
    );
  }
}
