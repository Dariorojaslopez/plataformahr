import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  JobOfferStatus,
  OfferEmploymentType,
  Prisma,
  SalaryPeriod,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { AtsTemplatesService } from '../../core/companies/ats-templates/ats-templates.service';
import { ATS_TEMPLATE_KIND } from '../../core/companies/ats-templates/ats-templates.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { OfferLetterApprovalsService } from './offer-letter-approvals.service';
import {
  fillOfferLetterBuffer,
  fillOfferLetterText,
  offerLetterPlaceholderValues,
} from './offer-letter-placeholders';
import {
  OFFER_LETTER_ERRORS,
  OFFER_LETTER_MAX_BYTES,
  OFFER_LETTER_MIME,
  type AllowedOfferLetterMime,
} from './offer-letter.constants';
import {
  buildOfferSignedFileName,
  deleteOfferSignedFile,
  readOfferSignedFile,
  resolveCompanyUploadsDir,
  writeOfferSignedFile,
} from './offer-letter.storage';

@Injectable()
export class OfferLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly templates: AtsTemplatesService,
    private readonly approvals: OfferLetterApprovalsService,
  ) {}

  async getLetterStatus(companyId: string, offerId: string) {
    const offer = await this.requireOffer(companyId, offerId);
    const company = await this.prisma.company.findFirstOrThrow({
      where: { id: companyId },
      select: {
        offerLetterTemplateFileName: true,
        offerLetterTemplateOriginalName: true,
      },
    });
    return {
      offerId,
      hasCompanyTemplate: Boolean(company.offerLetterTemplateFileName),
      companyTemplateName: company.offerLetterTemplateOriginalName,
      hasSignedLetter: Boolean(offer.signedOfferLetterFileName),
      signedLetterName: offer.signedOfferLetterOriginalName,
      signedLetterUploadedAt:
        offer.signedOfferLetterUploadedAt?.toISOString() ?? null,
      offerLetterApprovalStatus: offer.offerLetterApprovalStatus,
      offerLetterSentAt: offer.offerLetterSentAt?.toISOString() ?? null,
      offerLetterSendMode: offer.offerLetterSendMode,
      offerLetterCandidateSignedAt:
        offer.offerLetterCandidateSignedAt?.toISOString() ?? null,
      readyForHire: this.isSignedReady(
        Boolean(company.offerLetterTemplateFileName),
        Boolean(offer.signedOfferLetterFileName),
      ),
    };
  }

  async downloadTemplate(companyId: string, offerId: string) {
    await this.requireOffer(companyId, offerId);
    return this.templates.read(companyId, ATS_TEMPLATE_KIND.OFFER_LETTER);
  }

  async uploadSignedForApplication(
    companyId: string,
    userId: string,
    applicationId: string,
    file: Express.Multer.File | undefined,
  ) {
    const offerId = await this.ensureDraftOffer(
      companyId,
      userId,
      applicationId,
    );
    return this.uploadSigned(companyId, userId, offerId, file);
  }

  async downloadSignedForApplication(companyId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
      select: { jobOffer: { select: { id: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (!application.jobOffer) {
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
    }
    return this.downloadSigned(companyId, application.jobOffer.id);
  }

  async uploadSigned(
    companyId: string,
    userId: string,
    offerId: string,
    file: Express.Multer.File | undefined,
  ) {
    const offer = await this.requireOffer(companyId, offerId);
    this.assertFile(file);
    const mime = this.resolveMime(file.mimetype);
    const fileName = buildOfferSignedFileName(mime);
    const uploadsDir = resolveCompanyUploadsDir();
    const previous = offer.signedOfferLetterFileName;

    await writeOfferSignedFile({
      uploadsDir,
      companyId,
      fileName,
      buffer: file.buffer,
    });

    try {
      const updated = await this.prisma.jobOffer.update({
        where: { id: offerId },
        data: {
          signedOfferLetterFileName: fileName,
          signedOfferLetterOriginalName:
            file.originalname?.slice(0, 200) || fileName,
          signedOfferLetterMimeType: mime,
          signedOfferLetterUploadedAt: new Date(),
          signedOfferLetterUploadedByUserId: userId,
        },
      });

      if (previous && previous !== fileName) {
        await deleteOfferSignedFile({
          uploadsDir,
          companyId,
          fileName: previous,
        }).catch(() => undefined);
      }

      await this.audit.create({
        action: ATS_AUDIT.OFFER_SIGNED_LETTER_UPLOADED,
        entity: 'JobOffer',
        entityId: offerId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          offerId,
          originalName: updated.signedOfferLetterOriginalName,
        },
      });

      await this.approvals.startForFilledLetter(companyId, offerId, userId);

      return this.getLetterStatus(companyId, offerId);
    } catch (error) {
      await deleteOfferSignedFile({ uploadsDir, companyId, fileName }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async downloadSigned(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        signedOfferLetterFileName: true,
        signedOfferLetterOriginalName: true,
        signedOfferLetterMimeType: true,
        positionTitle: true,
        salaryAmount: true,
        salaryCurrency: true,
        salaryPeriod: true,
        employmentType: true,
        startDate: true,
        notes: true,
        application: {
          select: {
            candidate: {
              select: { firstName: true, lastName: true, city: true },
            },
          },
        },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (
      !offer.signedOfferLetterFileName ||
      !offer.signedOfferLetterMimeType ||
      !offer.signedOfferLetterOriginalName
    ) {
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
    }
    const buffer = await readOfferSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: offer.signedOfferLetterFileName,
    });
    const values = offerLetterPlaceholderValues({
      candidateName:
        `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`.trim(),
      positionTitle: offer.positionTitle,
      salaryAmount: offer.salaryAmount,
      salaryCurrency: offer.salaryCurrency,
      salaryPeriod: offer.salaryPeriod,
      employmentType: offer.employmentType,
      startDate: offer.startDate,
      notes: offer.notes,
      city: offer.application.candidate.city,
    });
    return {
      buffer: fillOfferLetterBuffer(buffer, values),
      mimeType: offer.signedOfferLetterMimeType,
      originalName: fillOfferLetterText(
        offer.signedOfferLetterOriginalName,
        values,
      ),
    };
  }

  async removeSigned(companyId: string, userId: string, offerId: string) {
    const offer = await this.requireOffer(companyId, offerId);
    if (!offer.signedOfferLetterFileName) {
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
    }
    const previous = offer.signedOfferLetterFileName;
    await this.prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        signedOfferLetterFileName: null,
        signedOfferLetterOriginalName: null,
        signedOfferLetterMimeType: null,
        signedOfferLetterUploadedAt: null,
        signedOfferLetterUploadedByUserId: null,
      },
    });
    await deleteOfferSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: previous,
    }).catch(() => undefined);

    await this.audit.create({
      action: ATS_AUDIT.OFFER_SIGNED_LETTER_REMOVED,
      entity: 'JobOffer',
      entityId: offerId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { offerId },
    });

    return this.getLetterStatus(companyId, offerId);
  }

  isSignedReady(hasTemplate: boolean, hasSigned: boolean): boolean {
    return !hasTemplate || hasSigned;
  }

  private async ensureDraftOffer(
    companyId: string,
    userId: string,
    applicationId: string,
  ) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
      select: {
        id: true,
        status: true,
        stage: true,
        vacancy: {
          select: {
            title: true,
            salaryAmount: true,
            salaryCurrency: true,
          },
        },
        jobOffer: { select: { id: true } },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.status !== ApplicationStatus.ACTIVE) {
      throw new BadRequestException('Application is not active');
    }
    if (application.stage !== ApplicationStage.OFFER) {
      throw new BadRequestException(OFFER_LETTER_ERRORS.STAGE);
    }
    if (application.jobOffer) {
      return application.jobOffer.id;
    }

    try {
      const created = await this.prisma.jobOffer.create({
        data: {
          companyId,
          applicationId,
          status: JobOfferStatus.DRAFT,
          positionTitle: application.vacancy.title,
          salaryAmount:
            application.vacancy.salaryAmount ?? new Prisma.Decimal(0),
          salaryCurrency: application.vacancy.salaryCurrency || 'COP',
          salaryPeriod: SalaryPeriod.MONTHLY,
          employmentType: OfferEmploymentType.FULL_TIME,
          createdByUserId: userId,
        },
        select: { id: true },
      });
      await this.audit.create({
        action: ATS_AUDIT.OFFER_CREATED,
        entity: 'JobOffer',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          offerId: created.id,
          applicationId,
          toStatus: JobOfferStatus.DRAFT,
          source: 'finalist-offer-letter',
        },
      });
      return created.id;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.jobOffer.findUnique({
          where: { applicationId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      throw error;
    }
  }

  private async requireOffer(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        id: true,
        signedOfferLetterFileName: true,
        signedOfferLetterOriginalName: true,
        signedOfferLetterMimeType: true,
        signedOfferLetterUploadedAt: true,
        offerLetterApprovalStatus: true,
        offerLetterSentAt: true,
        offerLetterSendMode: true,
        offerLetterCandidateSignedAt: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private assertFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException(OFFER_LETTER_ERRORS.MISSING);
    if (!file.buffer?.length) {
      throw new BadRequestException(OFFER_LETTER_ERRORS.EMPTY);
    }
    if (file.size > OFFER_LETTER_MAX_BYTES) {
      throw new PayloadTooLargeException(OFFER_LETTER_ERRORS.SIZE);
    }
  }

  private resolveMime(mimetype: string): AllowedOfferLetterMime {
    const allowed = Object.values(OFFER_LETTER_MIME) as string[];
    if (!allowed.includes(mimetype)) {
      throw new UnsupportedMediaTypeException(OFFER_LETTER_ERRORS.TYPE);
    }
    return mimetype as AllowedOfferLetterMime;
  }
}
