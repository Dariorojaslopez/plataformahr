import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Company } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeBrandPrimaryColor } from './branding.color';
import {
  COMPANY_BRANDING_AUDIT,
  BRANDING_ENTITY,
  LOGO_MAX_BYTES,
} from './branding.constants';
import { inspectLogoBuffer } from './branding.image';
import {
  buildLogoFileName,
  deleteCompanyLogoFile,
  readCompanyLogoFile,
  resolveCompanyUploadsDir,
  writeCompanyLogoFile,
} from './branding.storage';

export type CompanyBrandingResponse = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  brandPrimaryColor: string | null;
  hasLogo: boolean;
  logoUpdatedAt: string | null;
};

export type CompanyLogoFile = {
  buffer: Buffer;
  mimeType: string;
};

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  uploadsDir(): string {
    return resolveCompanyUploadsDir();
  }

  toBrandingResponse(company: Company): CompanyBrandingResponse {
    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      brandPrimaryColor: company.brandPrimaryColor,
      hasLogo: Boolean(company.logoFileName),
      logoUpdatedAt: company.logoUpdatedAt
        ? company.logoUpdatedAt.toISOString()
        : null,
    };
  }

  async getBranding(companyId: string): Promise<CompanyBrandingResponse> {
    const company = await this.requireCompany(companyId);
    return this.toBrandingResponse(company);
  }

  async updateBranding(
    companyId: string,
    userId: string,
    dto: { name?: string; brandPrimaryColor?: string | null },
  ): Promise<CompanyBrandingResponse> {
    if (dto.name === undefined && dto.brandPrimaryColor === undefined) {
      throw new BadRequestException('No branding fields to update');
    }

    let brandPrimaryColor: string | null | undefined;
    if (dto.brandPrimaryColor === null) {
      brandPrimaryColor = null;
    } else if (dto.brandPrimaryColor !== undefined) {
      const normalized = normalizeBrandPrimaryColor(dto.brandPrimaryColor);
      if (!normalized) {
        throw new BadRequestException(
          'brandPrimaryColor must be a hex color like #RRGGBB',
        );
      }
      brandPrimaryColor = normalized;
    }

    const company = await this.requireCompany(companyId);
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(brandPrimaryColor !== undefined ? { brandPrimaryColor } : {}),
      },
    });

    await this.audit.create({
      action: COMPANY_BRANDING_AUDIT.UPDATED,
      entity: BRANDING_ENTITY,
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        name: updated.name,
        brandPrimaryColor: updated.brandPrimaryColor,
        hasLogo: Boolean(updated.logoFileName),
      },
    });

    return this.toBrandingResponse(updated);
  }

  async replaceLogo(
    companyId: string,
    userId: string,
    file: { buffer: Buffer; size?: number } | undefined,
  ): Promise<CompanyBrandingResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A logo file is required');
    }
    if (
      file.buffer.length > LOGO_MAX_BYTES ||
      (file.size ?? 0) > LOGO_MAX_BYTES
    ) {
      throw new PayloadTooLargeException(
        'El archivo supera el tamaño máximo permitido.',
      );
    }

    const inspected = inspectLogoBuffer(file.buffer);
    if (!inspected.ok) {
      if (inspected.reason === 'size') {
        throw new PayloadTooLargeException(
          'El archivo supera el tamaño máximo permitido.',
        );
      }
      if (inspected.reason === 'mime' || inspected.reason === 'parse') {
        throw new UnsupportedMediaTypeException(
          'Logo must be a PNG, JPEG, or WebP image.',
        );
      }
      throw new BadRequestException(
        'Logo dimensions must be between 1 and 2048 pixels.',
      );
    }

    const company = await this.requireCompany(companyId);
    const fileName = buildLogoFileName(inspected.info.mime);
    const previousFileName = company.logoFileName;

    await writeCompanyLogoFile({
      uploadsDir: this.uploadsDir(),
      companyId,
      fileName,
      buffer: file.buffer,
    });

    try {
      const updated = await this.prisma.company.update({
        where: { id: company.id },
        data: {
          logoFileName: fileName,
          logoMimeType: inspected.info.mime,
          logoUpdatedAt: new Date(),
        },
      });

      if (previousFileName && previousFileName !== fileName) {
        await deleteCompanyLogoFile({
          uploadsDir: this.uploadsDir(),
          companyId,
          fileName: previousFileName,
        });
      }

      await this.audit.create({
        action: COMPANY_BRANDING_AUDIT.LOGO_REPLACED,
        entity: BRANDING_ENTITY,
        entityId: updated.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          hasLogo: true,
          mimeType: inspected.info.mime,
          byteLength: file.buffer.length,
        },
      });

      return this.toBrandingResponse(updated);
    } catch (error) {
      await deleteCompanyLogoFile({
        uploadsDir: this.uploadsDir(),
        companyId,
        fileName,
      });
      throw error;
    }
  }

  async removeLogo(
    companyId: string,
    userId: string,
  ): Promise<CompanyBrandingResponse> {
    const company = await this.requireCompany(companyId);
    const previousFileName = company.logoFileName;
    if (!previousFileName) {
      return this.toBrandingResponse(company);
    }

    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        logoFileName: null,
        logoMimeType: null,
        logoUpdatedAt: null,
      },
    });

    await deleteCompanyLogoFile({
      uploadsDir: this.uploadsDir(),
      companyId,
      fileName: previousFileName,
    });

    await this.audit.create({
      action: COMPANY_BRANDING_AUDIT.LOGO_REMOVED,
      entity: BRANDING_ENTITY,
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { hasLogo: false },
    });

    return this.toBrandingResponse(updated);
  }

  async readLogo(companyId: string): Promise<CompanyLogoFile> {
    const company = await this.requireCompany(companyId);
    if (!company.logoFileName || !company.logoMimeType) {
      throw new NotFoundException('Company logo not found');
    }
    try {
      const buffer = await readCompanyLogoFile({
        uploadsDir: this.uploadsDir(),
        companyId,
        fileName: company.logoFileName,
      });
      return { buffer, mimeType: company.logoMimeType };
    } catch {
      throw new NotFoundException('Company logo not found');
    }
  }

  private async requireCompany(companyId: string): Promise<Company> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }
}
