import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
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
import { XLSX_MIME } from './import.constants';
import { OrgImportService } from './import.service';
import type { OrgImportPayload } from './import.types';

function isXlsxBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function readImportPayload(req: Request): OrgImportPayload {
  const body = req.body as unknown;
  const contentType = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (contentType === XLSX_MIME) {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('El archivo Excel está vacío.');
    }
    return { xlsx: body };
  }

  if (typeof body === 'string') {
    return { csv: body };
  }
  if (Buffer.isBuffer(body)) {
    if (isXlsxBuffer(body)) {
      return { xlsx: body };
    }
    return { csv: body.toString('utf8') };
  }

  throw new BadRequestException(
    'El archivo debe enviarse como Excel (.xlsx) o CSV UTF-8.',
  );
}

@Controller('organization/import')
@UseGuards(JwtAuthGuard, CompanyContextGuard, PermissionGuard)
export class OrgImportController {
  constructor(private readonly orgImportService: OrgImportService) {}

  @Get('template')
  @RequirePermissions('organization.manage')
  async template(
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    if (format === 'csv') {
      const { csv, filename } = this.orgImportService.templateCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.send(csv);
      return;
    }

    const { buffer, filename } = await this.orgImportService.templateXlsx();
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermissions('organization.manage')
  preview(@CurrentTenant() tenant: TenantContext, @Req() req: Request) {
    return this.orgImportService.preview(
      tenant.companyId,
      readImportPayload(req),
    );
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
      readImportPayload(req),
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
