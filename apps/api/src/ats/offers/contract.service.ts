import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ApplicationStage, ContractApprovalStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { AtsTemplatesService } from '../../core/companies/ats-templates/ats-templates.service';
import { ATS_TEMPLATE_KIND } from '../../core/companies/ats-templates/ats-templates.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { ContractApprovalsService } from './contract-approvals.service';
import { ContractSendService } from './contract-send.service';
import {
  fillOfferLetterBuffer,
  fillOfferLetterText,
  offerLetterPlaceholderValues,
} from './offer-letter-placeholders';
import {
  CONTRACT_ERRORS,
  CONTRACT_MAX_BYTES,
  CONTRACT_MIME,
  type AllowedContractMime,
} from './contract.constants';
import {
  buildContractSignedFileName,
  deleteContractSignedFile,
  readContractSignedFile,
  resolveCompanyUploadsDir,
  writeContractSignedFile,
} from './contract.storage';

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly templates: AtsTemplatesService,
    private readonly approvals: ContractApprovalsService,
    private readonly send: ContractSendService,
  ) {}

  async getStatus(companyId: string, offerId: string) {
    const offer = await this.requireOffer(companyId, offerId);
    const company = await this.prisma.company.findFirstOrThrow({
      where: { id: companyId },
      select: {
        contractTemplateFileName: true,
        contractTemplateOriginalName: true,
      },
    });
    return {
      offerId,
      hasCompanyTemplate: Boolean(company.contractTemplateFileName),
      companyTemplateName: company.contractTemplateOriginalName,
      hasSignedContract: Boolean(offer.signedContractFileName),
      signedContractName: offer.signedContractOriginalName,
      signedContractUploadedAt:
        offer.signedContractUploadedAt?.toISOString() ?? null,
      contractApprovalStatus: offer.contractApprovalStatus,
      contractSentAt: offer.contractSentAt?.toISOString() ?? null,
      contractSendMode: offer.contractSendMode,
      contractCandidateSignedAt:
        offer.contractCandidateSignedAt?.toISOString() ?? null,
    };
  }

  async downloadTemplate(companyId: string, offerId: string) {
    await this.requireOffer(companyId, offerId);
    return this.templates.read(companyId, ATS_TEMPLATE_KIND.CONTRACT);
  }

  async uploadSignedForApplication(
    companyId: string,
    userId: string,
    applicationId: string,
    file: Express.Multer.File | undefined,
  ) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
      select: { stage: true, jobOffer: { select: { id: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.stage !== ApplicationStage.TO_HIRE) {
      throw new BadRequestException(CONTRACT_ERRORS.STAGE);
    }
    if (!application.jobOffer) {
      throw new NotFoundException('Offer not found');
    }
    return this.uploadSigned(
      companyId,
      userId,
      application.jobOffer.id,
      file,
    );
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
      throw new NotFoundException(CONTRACT_ERRORS.SIGNED_NOT_FOUND);
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
    const application = await this.prisma.application.findFirst({
      where: { id: offer.applicationId, companyId, deletedAt: null },
      select: { stage: true },
    });
    if (application?.stage !== ApplicationStage.TO_HIRE) {
      throw new BadRequestException(CONTRACT_ERRORS.STAGE);
    }
    this.assertFile(file);
    const mime = this.resolveMime(file.mimetype);
    const fileName = buildContractSignedFileName(mime);
    const uploadsDir = resolveCompanyUploadsDir();
    const previous = offer.signedContractFileName;

    await writeContractSignedFile({
      uploadsDir,
      companyId,
      fileName,
      buffer: file.buffer,
    });

    try {
      const updated = await this.prisma.jobOffer.update({
        where: { id: offerId },
        data: {
          signedContractFileName: fileName,
          signedContractOriginalName:
            file.originalname?.slice(0, 200) || fileName,
          signedContractMimeType: mime,
          signedContractUploadedAt: new Date(),
          signedContractUploadedByUserId: userId,
          contractSentAt: null,
          contractSendMode: null,
          contractSignToken: null,
          contractSignTokenExpiresAt: null,
          contractCandidateSignedAt: null,
        },
      });

      if (previous && previous !== fileName) {
        await deleteContractSignedFile({
          uploadsDir,
          companyId,
          fileName: previous,
        }).catch(() => undefined);
      }

      await this.audit.create({
        action: ATS_AUDIT.CONTRACT_UPLOADED,
        entity: 'JobOffer',
        entityId: offerId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          offerId,
          originalName: updated.signedContractOriginalName,
        },
      });

      const approvalStatus = await this.approvals.startForFilledContract(
        companyId,
        offerId,
        userId,
      );
      if (approvalStatus === ContractApprovalStatus.NOT_REQUIRED) {
        await this.send.sendApprovedContract({
          companyId,
          userId,
          offerId,
        });
      }

      return this.getStatus(companyId, offerId);
    } catch (error) {
      await deleteContractSignedFile({ uploadsDir, companyId, fileName }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async downloadSigned(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        signedContractFileName: true,
        signedContractOriginalName: true,
        signedContractMimeType: true,
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
      !offer.signedContractFileName ||
      !offer.signedContractMimeType ||
      !offer.signedContractOriginalName
    ) {
      throw new NotFoundException(CONTRACT_ERRORS.SIGNED_NOT_FOUND);
    }
    const buffer = await readContractSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: offer.signedContractFileName,
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
      mimeType: offer.signedContractMimeType,
      originalName: fillOfferLetterText(
        offer.signedContractOriginalName,
        values,
      ),
    };
  }

  private async requireOffer(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        id: true,
        applicationId: true,
        signedContractFileName: true,
        signedContractOriginalName: true,
        signedContractMimeType: true,
        signedContractUploadedAt: true,
        contractApprovalStatus: true,
        contractSentAt: true,
        contractSendMode: true,
        contractCandidateSignedAt: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private assertFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException(CONTRACT_ERRORS.MISSING);
    if (!file.buffer?.length) {
      throw new BadRequestException(CONTRACT_ERRORS.EMPTY);
    }
    if (file.size > CONTRACT_MAX_BYTES) {
      throw new PayloadTooLargeException(CONTRACT_ERRORS.SIZE);
    }
  }

  private resolveMime(mimetype: string): AllowedContractMime {
    const allowed = Object.values(CONTRACT_MIME) as string[];
    if (!allowed.includes(mimetype)) {
      throw new UnsupportedMediaTypeException(CONTRACT_ERRORS.TYPE);
    }
    return mimetype as AllowedContractMime;
  }
}
