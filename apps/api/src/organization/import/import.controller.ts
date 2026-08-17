import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { OrgImportService } from './import.service';

function readCsvBody(req: Request): string {
  const body = req.body as unknown;
  if (typeof body === 'string') {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }
  throw new BadRequestException(
    'El archivo debe enviarse como CSV UTF-8 (Content-Type: text/csv).',
  );
}

@Controller('organization/import')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class OrgImportController {
  constructor(private readonly orgImportService: OrgImportService) {}

  @Get('template')
  @RequirePermissions('organization.manage')
  template(@Res() res: Response) {
    const { csv, filename } = this.orgImportService.template();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermissions('organization.manage')
  preview(@CurrentTenant() tenant: TenantContext, @Req() req: Request) {
    return this.orgImportService.preview(tenant.companyId, readCsvBody(req));
  }

  @Post('apply')
  @RequirePermissions('organization.manage')
  async apply(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.orgImportService.apply(
      tenant.companyId,
      user.userId,
      readCsvBody(req),
    );
    if (!result.applied) {
      res.status(400).json({
        statusCode: 400,
        message: 'La importación tiene errores y no se aplicó.',
        ...result,
      });
      return;
    }
    res.status(201).json(result);
  }
}
