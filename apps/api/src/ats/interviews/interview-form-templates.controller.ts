import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  AddTemplateQuestionDto,
  CreateInterviewFormTemplateDto,
  UpdateInterviewFormTemplateDto,
} from './dto/interview.dto';
import { InterviewsService } from './interviews.service';

@Controller('ats/interview-form-templates')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class InterviewFormTemplatesController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  @RequirePermissions('ats.interview.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.interviewsService.listTemplates(tenant.companyId);
  }

  @Get(':id')
  @RequirePermissions('ats.interview.read')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.getTemplate(tenant.companyId, id);
  }

  @Post()
  @RequirePermissions('ats.interview.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInterviewFormTemplateDto,
  ) {
    return this.interviewsService.createTemplate(
      tenant.companyId,
      user.userId,
      dto,
    );
  }

  @Patch(':id')
  @RequirePermissions('ats.interview.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterviewFormTemplateDto,
  ) {
    return this.interviewsService.updateTemplate(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }

  @Post(':id/questions')
  @RequirePermissions('ats.interview.manage')
  addQuestion(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTemplateQuestionDto,
  ) {
    return this.interviewsService.addTemplateQuestion(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
