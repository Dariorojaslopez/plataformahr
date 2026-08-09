import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { ListPerformanceResultsQueryDto } from './dto/result.dto';
import { ResultsService } from './results.service';

@Controller('performance')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('results')
  @RequirePermissions('performance.result.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListPerformanceResultsQueryDto,
  ) {
    return this.resultsService.list(tenant.companyId, query);
  }

  @Get('results/export')
  @RequirePermissions('performance.analytics.read')
  async exportCsv(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListPerformanceResultsQueryDto,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.resultsService.exportCsv(
      tenant.companyId,
      query,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('results/mine')
  listMine(@CurrentTenant() tenant: TenantContext) {
    // Resource-scoped: no tenant-wide result.read required.
    return this.resultsService.listMine(tenant.companyId, tenant.userId);
  }

  @Get('results/:id')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Admin via result.read; employee via own RELEASED (404 otherwise).
    return this.resultsService.getById(
      tenant.companyId,
      tenant.userId,
      tenant.membershipId,
      id,
    );
  }

  @Post('cycles/:cycleId/participants/:participantId/result/calculate')
  @RequirePermissions('performance.result.manage')
  calculate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.resultsService.calculate(
      tenant.companyId,
      user.userId,
      cycleId,
      participantId,
    );
  }

  @Post('cycles/:cycleId/participants/:participantId/result/release')
  @RequirePermissions('performance.result.release')
  release(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.resultsService.release(
      tenant.companyId,
      user.userId,
      cycleId,
      participantId,
    );
  }
}
