import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { OfferLetterSendMode } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { HiringService } from '../hiring/hiring.service';
import {
  fillOfferLetterBuffer,
  fillOfferLetterText,
  htmlToPlainText,
  offerLetterPlaceholderValues,
  publicWebOrigin,
} from './offer-letter-placeholders';
import { CONTRACT_ERRORS, CONTRACT_SIGN_TOKEN_TTL_MS } from './contract.constants';
import {
  readContractSignedFile,
  resolveCompanyUploadsDir,
} from './contract.storage';

@Injectable()
export class ContractSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(forwardRef(() => HiringService))
    private readonly hiring: HiringService,
  ) {}

  async sendApprovedContract(input: {
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
            id: true,
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
            atsContractEmailSubject: true,
            atsContractEmailBody: true,
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
      throw new BadRequestException(CONTRACT_ERRORS.SIGNED_NOT_FOUND);
    }

    const candidateName =
      `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`.trim();
    const candidateEmail = offer.application.candidate.email?.trim() ?? '';
    if (!candidateEmail.includes('@')) {
      throw new BadRequestException(CONTRACT_ERRORS.CANDIDATE_EMAIL);
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
      offer.company.atsContractEmailSubject?.trim() ||
      `Contrato — ${offer.positionTitle}`;
    const bodyTemplate =
      offer.company.atsContractEmailBody?.trim() ||
      `<p>Hola [Nombre],</p><p>Te compartimos tu contrato para el cargo [Cargo].</p>`;
    const subject = fillOfferLetterText(subjectTemplate, values);
    let html = fillOfferLetterText(bodyTemplate, values);

    const digitalSignature = await this.hasDigitalSignature(input.companyId);
    const document = await readContractSignedFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId: input.companyId,
      fileName: offer.signedContractFileName,
    });
    const filledDocument = fillOfferLetterBuffer(document, values);
    const filename = fillOfferLetterText(
      offer.signedContractOriginalName,
      values,
    );

    let sendMode: OfferLetterSendMode = OfferLetterSendMode.ATTACHMENT;
    let signUrl: string | null = null;
    const now = new Date();
    if (digitalSignature) {
      sendMode = OfferLetterSendMode.DIGITAL_SIGNATURE;
      const token = randomBytes(32).toString('hex');
      signUrl = `${publicWebOrigin()}/sign/contract/${token}`;
      html = `${html}<p>Para revisar y firmar tu contrato, ingresa a este enlace:</p><p><a href="${signUrl}">${signUrl}</a></p>`;
      await this.prisma.jobOffer.update({
        where: { id: offer.id },
        data: {
          contractSendMode: sendMode,
          contractSentAt: now,
          contractSignToken: token,
          contractSignTokenExpiresAt: new Date(
            Date.now() + CONTRACT_SIGN_TOKEN_TTL_MS,
          ),
        },
      });
    } else {
      await this.prisma.jobOffer.update({
        where: { id: offer.id },
        data: {
          contractSendMode: sendMode,
          contractSentAt: now,
          contractSignToken: null,
          contractSignTokenExpiresAt: null,
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
              contentType: offer.signedContractMimeType,
            },
          ],
    });

    await this.audit.create({
      action: ATS_AUDIT.CONTRACT_SENT,
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

    if (sendMode === OfferLetterSendMode.ATTACHMENT) {
      await this.hiring.tryCompleteHireFromContract(
        input.companyId,
        input.userId,
        offer.application.id,
      );
    }

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
