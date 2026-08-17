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
  CreatePositionCustomFieldDefinitionDto,
  UpdatePositionCustomFieldDefinitionDto,
} from './dto/position-custom-field.dto';
import { PositionCustomFieldsService } from './position-custom-fields.service';

@Controller('organization/position-custom-fields')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class PositionCustomFieldsController {
  constructor(
    private readonly positionCustomFieldsService: PositionCustomFieldsService,
  ) {}

  @Get()
  @RequirePermissions('organization.read')
  list(@CurrentTenant() tenant: TenantContext) {
    return this.positionCustomFieldsService.listDefinitions(tenant.companyId);
  }

  @Post()
  @RequirePermissions('organization.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePositionCustomFieldDefinitionDto,
  ) {
    return this.positionCustomFieldsService.createDefinition(
      tenant.companyId,
      user.userId,
      dto,
    );
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePositionCustomFieldDefinitionDto,
  ) {
    return this.positionCustomFieldsService.updateDefinition(
      tenant.companyId,
      user.userId,
      id,
      dto,
    );
  }
}
