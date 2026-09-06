import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { AtsTemplatesService } from '../../core/companies/ats-templates/ats-templates.service';
import { ATS_TEMPLATE_KIND } from '../../core/companies/ats-templates/ats-templates.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
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

      return this.getLetterStatus(companyId, offerId);
    } catch (error) {
      await deleteOfferSignedFile({ uploadsDir, companyId, fileName }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async downloadSigned(companyId: string, offerId: string) {
    const offer = await this.requireOffer(companyId, offerId);
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
    return {
      buffer,
      mimeType: offer.signedOfferLetterMimeType,
      originalName: offer.signedOfferLetterOriginalName,
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

  private async requireOffer(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        id: true,
        signedOfferLetterFileName: true,
        signedOfferLetterOriginalName: true,
        signedOfferLetterMimeType: true,
        signedOfferLetterUploadedAt: true,
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
