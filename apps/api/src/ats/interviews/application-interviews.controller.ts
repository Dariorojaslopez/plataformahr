import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { CreateInterviewDto } from './dto/interview.dto';
import { InterviewsService } from './interviews.service';

@Controller('ats/applications')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class ApplicationInterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get(':applicationId/interviews')
  @RequirePermissions('ats.interview.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.interviewsService.listByApplication(
      tenant.companyId,
      applicationId,
    );
  }

  @Post(':applicationId/interviews')
  @RequirePermissions('ats.interview.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateInterviewDto,
  ) {
    return this.interviewsService.create(
      tenant.companyId,
      user.userId,
      applicationId,
      dto,
    );
  }
}
