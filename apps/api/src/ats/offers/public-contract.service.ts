import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  forwardRef,
} from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { HiringService } from '../hiring/hiring.service';
import {
  fillOfferLetterBuffer,
  offerLetterPlaceholderValues,
} from './offer-letter-placeholders';
import {
  CONTRACT_ERRORS,
  CONTRACT_MIME,
  CONTRACT_SIGN_IMAGE_MAX_BYTES,
  CONTRACT_SIGN_IMAGE_MIME,
  type AllowedContractMime,
  type AllowedContractSignImageMime,
} from './contract.constants';
import {
  buildContractCandidateSignedFileName,
  buildContractSignImageFileName,
  readContractSignedFile,
  resolveCompanyUploadsDir,
  writeContractSignedFile,
} from './contract.storage';

@Injectable()
export class PublicContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => HiringService))
    private readonly hiring: HiringService,
  ) {}

  async getByToken(token: string) {
    const offer = await this.requireToken(token);
    return {
      token,
      companyName: offer.company.name,
      candidateName:
        `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`.trim(),
      positionTitle: offer.positionTitle,
      signed: Boolean(offer.contractCandidateSignedAt),
      signedAt: offer.contractCandidateSignedAt?.toISOString() ?? null,
      documentName: offer.signedContractOriginalName,
      documentMime: offer.signedContractMimeType,
    };
  }

  async downloadByToken(token: string) {
    const offer = await this.requireToken(token);
    if (
      !offer.signedContractFileName ||
      !offer.signedContractMimeType ||
      !offer.signedContractOriginalName
    ) {
      throw new NotFoundException(CONTRACT_ERRORS.SIGNED_NOT_FOUND);
    }
    const buffer = await readContractSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId: offer.companyId,
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
      originalName: offer.signedContractOriginalName,
    };
  }

  async sign(
    token: string,
    file: Express.Multer.File | undefined,
    accepted: boolean,
  ) {
    if (!accepted) {
      throw new BadRequestException(CONTRACT_ERRORS.SIGN_ACCEPT);
    }
    this.assertSignature(file);
    const offer = await this.requireToken(token);
    if (offer.contractCandidateSignedAt) {
      throw new BadRequestException(CONTRACT_ERRORS.SIGN_ALREADY);
    }
    if (
      !offer.signedContractFileName ||
      !offer.signedContractMimeType ||
      !offer.signedContractOriginalName
    ) {
      throw new NotFoundException(CONTRACT_ERRORS.SIGNED_NOT_FOUND);
    }

    const mime = this.resolveSignatureMime(file.mimetype);
    const contractMime = offer.signedContractMimeType as AllowedContractMime;
    if (
      contractMime !== CONTRACT_MIME.PDF &&
      contractMime !== CONTRACT_MIME.DOCX
    ) {
      throw new UnsupportedMediaTypeException(CONTRACT_ERRORS.TYPE);
    }

    const uploadsDir = resolveCompanyUploadsDir();
    const original = await readContractSignedFile({
      uploadsDir,
      companyId: offer.companyId,
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
    const filled = fillOfferLetterBuffer(original, values);
    const signatureName = buildContractSignImageFileName(mime);
    const signedCopyName = buildContractCandidateSignedFileName(contractMime);

    await writeContractSignedFile({
      uploadsDir,
      companyId: offer.companyId,
      fileName: signatureName,
      buffer: file.buffer,
    });
    await writeContractSignedFile({
      uploadsDir,
      companyId: offer.companyId,
      fileName: signedCopyName,
      buffer: filled,
    });

    const now = new Date();
    await this.prisma.jobOffer.update({
      where: { id: offer.id },
      data: {
        contractCandidateSignedAt: now,
        contractSignatureFileName: signatureName,
        contractSignatureOriginalName:
          file.originalname?.slice(0, 200) || signatureName,
        contractSignatureMimeType: mime,
        candidateSignedContractFileName: signedCopyName,
        candidateSignedContractOriginalName: offer.signedContractOriginalName,
        candidateSignedContractMimeType: offer.signedContractMimeType,
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.CONTRACT_CANDIDATE_SIGNED,
      entity: 'JobOffer',
      entityId: offer.id,
      company: { connect: { id: offer.companyId } },
      metadata: { offerId: offer.id },
    });

    await this.hiring.tryCompleteHireFromContract(
      offer.companyId,
      offer.createdByUserId,
      offer.application.id,
    );

    return this.getByToken(token);
  }

  private async requireToken(token: string) {
    const normalized = token.trim();
    if (!normalized) {
      throw new NotFoundException(CONTRACT_ERRORS.SIGN_TOKEN);
    }
    const offer = await this.prisma.jobOffer.findFirst({
      where: { contractSignToken: normalized },
      include: {
        company: { select: { name: true } },
        application: {
          select: {
            id: true,
            candidate: {
              select: {
                firstName: true,
                lastName: true,
                city: true,
              },
            },
          },
        },
      },
    });
    if (!offer) {
      throw new NotFoundException(CONTRACT_ERRORS.SIGN_TOKEN);
    }
    if (
      offer.contractSignTokenExpiresAt &&
      offer.contractSignTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new GoneException(CONTRACT_ERRORS.SIGN_TOKEN);
    }
    return offer;
  }

  private assertSignature(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException(CONTRACT_ERRORS.SIGN_IMAGE);
    if (!file.buffer?.length) {
      throw new BadRequestException(CONTRACT_ERRORS.EMPTY);
    }
    if (file.size > CONTRACT_SIGN_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException(CONTRACT_ERRORS.SIGN_IMAGE_SIZE);
    }
  }

  private resolveSignatureMime(
    mimetype: string,
  ): AllowedContractSignImageMime {
    const allowed = Object.values(CONTRACT_SIGN_IMAGE_MIME) as string[];
    if (!allowed.includes(mimetype)) {
      throw new UnsupportedMediaTypeException(CONTRACT_ERRORS.SIGN_IMAGE_TYPE);
    }
    return mimetype as AllowedContractSignImageMime;
  }
}
