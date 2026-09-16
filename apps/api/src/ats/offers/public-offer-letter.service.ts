import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import {
  fillOfferLetterBuffer,
  offerLetterPlaceholderValues,
} from './offer-letter-placeholders';
import {
  OFFER_LETTER_ERRORS,
  OFFER_LETTER_MIME,
  OFFER_SIGN_IMAGE_MAX_BYTES,
  OFFER_SIGN_IMAGE_MIME,
  type AllowedOfferLetterMime,
  type AllowedOfferSignImageMime,
} from './offer-letter.constants';
import {
  buildOfferCandidateSignedFileName,
  buildOfferSignImageFileName,
  readOfferSignedFile,
  resolveCompanyUploadsDir,
  writeOfferSignedFile,
} from './offer-letter.storage';

@Injectable()
export class PublicOfferLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getByToken(token: string) {
    const offer = await this.requireToken(token);
    return {
      token,
      companyName: offer.company.name,
      candidateName:
        `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`.trim(),
      positionTitle: offer.positionTitle,
      signed: Boolean(offer.offerLetterCandidateSignedAt),
      signedAt: offer.offerLetterCandidateSignedAt?.toISOString() ?? null,
      documentName: offer.signedOfferLetterOriginalName,
      documentMime: offer.signedOfferLetterMimeType,
    };
  }

  async downloadByToken(token: string) {
    const offer = await this.requireToken(token);
    if (
      !offer.signedOfferLetterFileName ||
      !offer.signedOfferLetterMimeType ||
      !offer.signedOfferLetterOriginalName
    ) {
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
    }
    const buffer = await readOfferSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId: offer.companyId,
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
      originalName: offer.signedOfferLetterOriginalName,
    };
  }

  async sign(
    token: string,
    file: Express.Multer.File | undefined,
    accepted: boolean,
  ) {
    if (!accepted) {
      throw new BadRequestException(OFFER_LETTER_ERRORS.SIGN_ACCEPT);
    }
    this.assertSignature(file);
    const offer = await this.requireToken(token);
    if (offer.offerLetterCandidateSignedAt) {
      throw new BadRequestException(OFFER_LETTER_ERRORS.SIGN_ALREADY);
    }
    if (
      !offer.signedOfferLetterFileName ||
      !offer.signedOfferLetterMimeType ||
      !offer.signedOfferLetterOriginalName
    ) {
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
    }

    const mime = this.resolveSignatureMime(file.mimetype);
    const letterMime = offer.signedOfferLetterMimeType as AllowedOfferLetterMime;
    if (
      letterMime !== OFFER_LETTER_MIME.PDF &&
      letterMime !== OFFER_LETTER_MIME.DOCX
    ) {
      throw new UnsupportedMediaTypeException(OFFER_LETTER_ERRORS.TYPE);
    }

    const uploadsDir = resolveCompanyUploadsDir();
    const original = await readOfferSignedFile({
      uploadsDir,
      companyId: offer.companyId,
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
    const filled = fillOfferLetterBuffer(original, values);
    const signatureName = buildOfferSignImageFileName(mime);
    const signedCopyName = buildOfferCandidateSignedFileName(letterMime);

    await writeOfferSignedFile({
      uploadsDir,
      companyId: offer.companyId,
      fileName: signatureName,
      buffer: file.buffer,
    });
    await writeOfferSignedFile({
      uploadsDir,
      companyId: offer.companyId,
      fileName: signedCopyName,
      buffer: filled,
    });

    const now = new Date();
    await this.prisma.jobOffer.update({
      where: { id: offer.id },
      data: {
        offerLetterCandidateSignedAt: now,
        offerLetterSignatureFileName: signatureName,
        offerLetterSignatureOriginalName:
          file.originalname?.slice(0, 200) || signatureName,
        offerLetterSignatureMimeType: mime,
        candidateSignedLetterFileName: signedCopyName,
        candidateSignedLetterOriginalName:
          offer.signedOfferLetterOriginalName,
        candidateSignedLetterMimeType: offer.signedOfferLetterMimeType,
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_LETTER_CANDIDATE_SIGNED,
      entity: 'JobOffer',
      entityId: offer.id,
      company: { connect: { id: offer.companyId } },
      metadata: { offerId: offer.id },
    });

    return this.getByToken(token);
  }

  private async requireToken(token: string) {
    const normalized = token.trim();
    if (!normalized) {
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGN_TOKEN);
    }
    const offer = await this.prisma.jobOffer.findFirst({
      where: { offerLetterSignToken: normalized },
      include: {
        company: { select: { name: true } },
        application: {
          select: {
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
      throw new NotFoundException(OFFER_LETTER_ERRORS.SIGN_TOKEN);
    }
    if (
      offer.offerLetterSignTokenExpiresAt &&
      offer.offerLetterSignTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new GoneException(OFFER_LETTER_ERRORS.SIGN_TOKEN);
    }
    return offer;
  }

  private assertSignature(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException(OFFER_LETTER_ERRORS.SIGN_IMAGE);
    if (!file.buffer?.length) {
      throw new BadRequestException(OFFER_LETTER_ERRORS.EMPTY);
    }
    if (file.size > OFFER_SIGN_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException(OFFER_LETTER_ERRORS.SIGN_IMAGE_SIZE);
    }
  }

  private resolveSignatureMime(mimetype: string): AllowedOfferSignImageMime {
    const allowed = Object.values(OFFER_SIGN_IMAGE_MIME) as string[];
    if (!allowed.includes(mimetype)) {
      throw new UnsupportedMediaTypeException(
        OFFER_LETTER_ERRORS.SIGN_IMAGE_TYPE,
      );
    }
    return mimetype as AllowedOfferSignImageMime;
  }
}
