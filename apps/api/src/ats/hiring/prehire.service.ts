import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PreHireCheckStatus,
  PreHireDocumentKind,
  type Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import type { UpdatePreHireDto } from './dto/prehire.dto';
import {
  PREHIRE_ERRORS,
  PREHIRE_MIME,
  type AllowedPreHireMime,
  isPreHireClear,
} from './prehire.constants';
import {
  buildPreHireFileName,
  deletePreHireFile,
  readPreHireFile,
  resolveCompanyUploadsDir,
  writePreHireFile,
} from './prehire.storage';

const DOC_SELECT = {
  id: true,
  kind: true,
  originalName: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PreHireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(companyId: string, applicationId: string) {
    const application = await this.requireApplication(companyId, applicationId);
    const documents = await this.prisma.applicationPreHireDocument.findMany({
      where: { companyId, applicationId },
      select: DOC_SELECT,
      orderBy: { kind: 'asc' },
    });
    return {
      applicationId: application.id,
      securityStudyStatus: application.securityStudyStatus,
      medicalExamStatus: application.medicalExamStatus,
      ready: this.isReady(
        application.securityStudyStatus,
        application.medicalExamStatus,
      ),
      documents,
    };
  }

  async update(
    companyId: string,
    userId: string,
    applicationId: string,
    dto: UpdatePreHireDto,
  ) {
    await this.requireApplication(companyId, applicationId);
    if (!dto.securityStudyStatus && !dto.medicalExamStatus) {
      throw new BadRequestException('No pre-hire fields to update');
    }

    const data: Prisma.ApplicationUpdateInput = {};
    if (dto.securityStudyStatus) {
      data.securityStudyStatus = dto.securityStudyStatus;
    }
    if (dto.medicalExamStatus) {
      data.medicalExamStatus = dto.medicalExamStatus;
    }

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data,
      select: {
        id: true,
        securityStudyStatus: true,
        medicalExamStatus: true,
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.PREHIRE_UPDATED,
      entity: 'Application',
      entityId: applicationId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        securityStudyStatus: updated.securityStudyStatus,
        medicalExamStatus: updated.medicalExamStatus,
      },
    });

    return this.get(companyId, applicationId);
  }

  async uploadDocument(
    companyId: string,
    userId: string,
    applicationId: string,
    kind: PreHireDocumentKind,
    file: Express.Multer.File | undefined,
  ) {
    await this.requireApplication(companyId, applicationId);
    this.assertFile(file);
    const mime = this.resolveMime(file.mimetype);
    const fileName = buildPreHireFileName(kind, mime);
    const uploadsDir = resolveCompanyUploadsDir();

    const existing = await this.prisma.applicationPreHireDocument.findUnique({
      where: { applicationId_kind: { applicationId, kind } },
    });

    await writePreHireFile({
      uploadsDir,
      companyId,
      fileName,
      buffer: file.buffer,
    });

    try {
      const doc = await this.prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.applicationPreHireDocument.delete({
            where: { id: existing.id },
          });
        }
        return tx.applicationPreHireDocument.create({
          data: {
            companyId,
            applicationId,
            kind,
            fileName,
            originalName: file.originalname?.slice(0, 200) || fileName,
            mimeType: mime,
            uploadedByUserId: userId,
          },
          select: DOC_SELECT,
        });
      });

      if (existing?.fileName) {
        await deletePreHireFile({
          uploadsDir,
          companyId,
          fileName: existing.fileName,
        }).catch(() => undefined);
      }

      await this.audit.create({
        action: ATS_AUDIT.PREHIRE_DOCUMENT_UPLOADED,
        entity: 'Application',
        entityId: applicationId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { kind, documentId: doc.id },
      });

      return this.get(companyId, applicationId);
    } catch (error) {
      await deletePreHireFile({ uploadsDir, companyId, fileName }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async readDocument(
    companyId: string,
    applicationId: string,
    kind: PreHireDocumentKind,
  ) {
    await this.requireApplication(companyId, applicationId);
    const doc = await this.prisma.applicationPreHireDocument.findUnique({
      where: { applicationId_kind: { applicationId, kind } },
    });
    if (!doc || doc.companyId !== companyId) {
      throw new NotFoundException(PREHIRE_ERRORS.NOT_FOUND);
    }
    const buffer = await readPreHireFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: doc.fileName,
    });
    return {
      buffer,
      mimeType: doc.mimeType,
      originalName: doc.originalName,
    };
  }

  assertReadyOrThrow(application: {
    securityStudyStatus: PreHireCheckStatus;
    medicalExamStatus: PreHireCheckStatus;
  }) {
    if (
      !this.isReady(
        application.securityStudyStatus,
        application.medicalExamStatus,
      )
    ) {
      throw new BadRequestException(
        'Estudio de seguridad y exámenes médicos deben estar aprobados o no requeridos antes de contratar',
      );
    }
  }

  private isReady(
    security: PreHireCheckStatus | string,
    medical: PreHireCheckStatus | string,
  ) {
    return isPreHireClear(security) && isPreHireClear(medical);
  }

  private async requireApplication(companyId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
      select: {
        id: true,
        securityStudyStatus: true,
        medicalExamStatus: true,
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  private assertFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException(PREHIRE_ERRORS.MISSING);
    }
    if (!file.buffer?.length) {
      throw new BadRequestException(PREHIRE_ERRORS.EMPTY);
    }
  }

  private resolveMime(mimetype: string): AllowedPreHireMime {
    const allowed = Object.values(PREHIRE_MIME) as string[];
    if (!allowed.includes(mimetype)) {
      throw new BadRequestException(PREHIRE_ERRORS.TYPE);
    }
    return mimetype as AllowedPreHireMime;
  }
}
