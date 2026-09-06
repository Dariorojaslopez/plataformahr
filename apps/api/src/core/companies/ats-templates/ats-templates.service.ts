import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Company, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompaniesService } from '../companies.service';
import {
  ATS_TEMPLATE_ERRORS,
  ATS_TEMPLATE_KIND,
  ATS_TEMPLATE_MAX_BYTES,
  ATS_TEMPLATE_MIME,
  ATS_TEMPLATES_AUDIT,
  type AllowedAtsTemplateMime,
  type AtsTemplateKind,
} from './ats-templates.constants';
import {
  buildAtsTemplateFileName,
  deleteAtsTemplateFile,
  readAtsTemplateFile,
  resolveCompanyUploadsDir,
  writeAtsTemplateFile,
} from './ats-templates.storage';

@Injectable()
export class AtsTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly companies: CompaniesService,
  ) {}

  async upload(
    companyId: string,
    userId: string,
    kind: AtsTemplateKind,
    file: Express.Multer.File | undefined,
  ) {
    this.assertFile(file);
    const mime = this.resolveMime(file.mimetype);
    const company = await this.requireCompany(companyId);
    const previous = this.metaForKind(company, kind);
    const fileName = buildAtsTemplateFileName(kind, mime);
    const uploadsDir = resolveCompanyUploadsDir();

    await writeAtsTemplateFile({
      uploadsDir,
      companyId,
      fileName,
      buffer: file.buffer,
    });

    try {
      const updated = await this.prisma.company.update({
        where: { id: companyId },
        data: this.updateDataForKind(kind, {
          fileName,
          originalName: file.originalname?.slice(0, 200) || fileName,
          mimeType: mime,
        }),
      });

      if (previous.fileName && previous.fileName !== fileName) {
        await deleteAtsTemplateFile({
          uploadsDir,
          companyId,
          fileName: previous.fileName,
        }).catch(() => undefined);
      }

      await this.audit.create({
        action: ATS_TEMPLATES_AUDIT.UPLOADED,
        entity: 'Company',
        entityId: companyId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          kind,
          originalName:
            updated[
              kind === ATS_TEMPLATE_KIND.OFFER_LETTER
                ? 'offerLetterTemplateOriginalName'
                : 'contractTemplateOriginalName'
            ],
        },
      });

      return this.companies.toCurrentResponse(updated);
    } catch (error) {
      await deleteAtsTemplateFile({ uploadsDir, companyId, fileName }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async remove(companyId: string, userId: string, kind: AtsTemplateKind) {
    const company = await this.requireCompany(companyId);
    const previous = this.metaForKind(company, kind);
    if (!previous.fileName) {
      throw new NotFoundException(ATS_TEMPLATE_ERRORS.NOT_FOUND);
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: this.updateDataForKind(kind, {
        fileName: null,
        originalName: null,
        mimeType: null,
      }),
    });

    await deleteAtsTemplateFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: previous.fileName,
    }).catch(() => undefined);

    await this.audit.create({
      action: ATS_TEMPLATES_AUDIT.REMOVED,
      entity: 'Company',
      entityId: companyId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { kind },
    });

    return this.companies.toCurrentResponse(updated);
  }

  async read(companyId: string, kind: AtsTemplateKind) {
    const company = await this.requireCompany(companyId);
    const meta = this.metaForKind(company, kind);
    if (!meta.fileName || !meta.mimeType) {
      throw new NotFoundException(ATS_TEMPLATE_ERRORS.NOT_FOUND);
    }
    const buffer = await readAtsTemplateFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: meta.fileName,
    });
    return {
      buffer,
      mimeType: meta.mimeType,
      originalName: meta.originalName || meta.fileName,
    };
  }

  private metaForKind(company: Company, kind: AtsTemplateKind) {
    if (kind === ATS_TEMPLATE_KIND.OFFER_LETTER) {
      return {
        fileName: company.offerLetterTemplateFileName,
        originalName: company.offerLetterTemplateOriginalName,
        mimeType: company.offerLetterTemplateMimeType,
      };
    }
    return {
      fileName: company.contractTemplateFileName,
      originalName: company.contractTemplateOriginalName,
      mimeType: company.contractTemplateMimeType,
    };
  }

  private updateDataForKind(
    kind: AtsTemplateKind,
    values: {
      fileName: string | null;
      originalName: string | null;
      mimeType: string | null;
    },
  ): Prisma.CompanyUpdateInput {
    if (kind === ATS_TEMPLATE_KIND.OFFER_LETTER) {
      return {
        offerLetterTemplateFileName: values.fileName,
        offerLetterTemplateOriginalName: values.originalName,
        offerLetterTemplateMimeType: values.mimeType,
      };
    }
    return {
      contractTemplateFileName: values.fileName,
      contractTemplateOriginalName: values.originalName,
      contractTemplateMimeType: values.mimeType,
    };
  }

  private async requireCompany(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  private assertFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException(ATS_TEMPLATE_ERRORS.MISSING);
    }
    if (!file.buffer?.length) {
      throw new BadRequestException(ATS_TEMPLATE_ERRORS.EMPTY);
    }
    if (file.size > ATS_TEMPLATE_MAX_BYTES) {
      throw new PayloadTooLargeException(ATS_TEMPLATE_ERRORS.SIZE);
    }
  }

  private resolveMime(mimetype: string): AllowedAtsTemplateMime {
    const allowed = Object.values(ATS_TEMPLATE_MIME) as string[];
    if (!allowed.includes(mimetype)) {
      throw new UnsupportedMediaTypeException(ATS_TEMPLATE_ERRORS.TYPE);
    }
    return mimetype as AllowedAtsTemplateMime;
  }
}
