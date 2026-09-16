import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OfferLetterSendMode } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import {
  fillOfferLetterBuffer,
  fillOfferLetterText,
  htmlToPlainText,
  offerLetterPlaceholderValues,
  publicWebOrigin,
} from './offer-letter-placeholders';
import {
  OFFER_LETTER_ERRORS,
  OFFER_SIGN_TOKEN_TTL_MS,
} from './offer-letter.constants';
import {
  readOfferSignedFile,
  resolveCompanyUploadsDir,
} from './offer-letter.storage';

@Injectable()
export class OfferLetterSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async sendApprovedLetter(input: {
    companyId: string;
    userId: string;
    offerId: string;
    signerName?: string | null;
  }) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: input.offerId, companyId: input.companyId },
      include: {
        application: {
          select: {
            candidate: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                city: true,
              },
            },
          },
        },
        company: {
          select: {
            name: true,
            atsOfferLetterEmailSubject: true,
            atsOfferLetterEmailBody: true,
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
      throw new BadRequestException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
    }

    const candidateName =
      `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`.trim();
    const candidateEmail = offer.application.candidate.email?.trim() ?? '';
    if (!candidateEmail.includes('@')) {
      throw new BadRequestException(OFFER_LETTER_ERRORS.CANDIDATE_EMAIL);
    }

    const values = offerLetterPlaceholderValues({
      candidateName,
      positionTitle: offer.positionTitle,
      salaryAmount: offer.salaryAmount,
      salaryCurrency: offer.salaryCurrency,
      salaryPeriod: offer.salaryPeriod,
      employmentType: offer.employmentType,
      startDate: offer.startDate,
      notes: offer.notes,
      city: offer.application.candidate.city,
      signerName: input.signerName,
    });

    const subjectTemplate =
      offer.company.atsOfferLetterEmailSubject?.trim() ||
      `Carta oferta — ${offer.positionTitle}`;
    const bodyTemplate =
      offer.company.atsOfferLetterEmailBody?.trim() ||
      `<p>Hola [Nombre],</p><p>Te compartimos tu carta oferta para el cargo [Cargo].</p>`;
    const subject = fillOfferLetterText(subjectTemplate, values);
    let html = fillOfferLetterText(bodyTemplate, values);

    const digitalSignature = await this.hasDigitalSignature(input.companyId);
    const document = await readOfferSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId: input.companyId,
      fileName: offer.signedOfferLetterFileName,
    });
    const filledDocument = fillOfferLetterBuffer(document, values);
    const filename = fillOfferLetterText(
      offer.signedOfferLetterOriginalName,
      values,
    );

    let sendMode: OfferLetterSendMode = OfferLetterSendMode.ATTACHMENT;
    let signUrl: string | null = null;
    if (digitalSignature) {
      sendMode = OfferLetterSendMode.DIGITAL_SIGNATURE;
      const token = randomBytes(32).toString('hex');
      signUrl = `${publicWebOrigin()}/sign/offer-letter/${token}`;
      html = `${html}<p>Para revisar y firmar tu carta oferta, ingresa a este enlace:</p><p><a href="${signUrl}">${signUrl}</a></p>`;
      await this.prisma.jobOffer.update({
        where: { id: offer.id },
        data: {
          offerLetterSendMode: sendMode,
          offerLetterSentAt: new Date(),
          offerLetterSignToken: token,
          offerLetterSignTokenExpiresAt: new Date(
            Date.now() + OFFER_SIGN_TOKEN_TTL_MS,
          ),
        },
      });
    } else {
      await this.prisma.jobOffer.update({
        where: { id: offer.id },
        data: {
          offerLetterSendMode: sendMode,
          offerLetterSentAt: new Date(),
          offerLetterSignToken: null,
          offerLetterSignTokenExpiresAt: null,
        },
      });
    }

    const text = htmlToPlainText(html);
    const delivery = await this.mail.sendText({
      to: candidateEmail,
      subject,
      text,
      html,
      attachments: digitalSignature
        ? undefined
        : [
            {
              filename,
              content: filledDocument,
              contentType: offer.signedOfferLetterMimeType,
            },
          ],
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_LETTER_SENT,
      entity: 'JobOffer',
      entityId: offer.id,
      company: { connect: { id: input.companyId } },
      user: { connect: { id: input.userId } },
      metadata: {
        offerId: offer.id,
        sendMode,
        email: candidateEmail,
        subject,
        signUrl,
        deliveryStatus: delivery.status,
        deliveryReason: delivery.reason ?? null,
      },
    });

    return { sendMode, signUrl, deliveryStatus: delivery.status };
  }

  private async hasDigitalSignature(companyId: string): Promise<boolean> {
    const row = await this.prisma.companyFeature.findFirst({
      where: {
        companyId,
        feature: 'premium.digital-signature',
        enabled: true,
      },
      select: { id: true },
    });
    return Boolean(row);
  }
}
