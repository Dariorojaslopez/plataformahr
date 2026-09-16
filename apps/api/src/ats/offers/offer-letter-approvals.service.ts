import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  OfferLetterApprovalStatus,
  type Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { OFFER_LETTER_ERRORS } from './offer-letter.constants';
import { OfferLetterSendService } from './offer-letter-send.service';

const STEP_INCLUDE = {
  position: { select: { id: true, name: true } },
  approverEmployee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class OfferLetterApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly send: OfferLetterSendService,
  ) {}

  async getByOffer(companyId: string, offerId: string) {
    const offer = await this.requireOffer(companyId, offerId);
    const steps = await this.prisma.jobOfferOfferLetterApproval.findMany({
      where: { companyId, jobOfferId: offerId },
      orderBy: { sequence: 'asc' },
      include: STEP_INCLUDE,
    });
    return {
      offerId,
      applicationId: offer.applicationId,
      offerLetterApprovalStatus: offer.offerLetterApprovalStatus,
      offerLetterApprovalStartedAt:
        offer.offerLetterApprovalStartedAt?.toISOString() ?? null,
      offerLetterApprovalCompletedAt:
        offer.offerLetterApprovalCompletedAt?.toISOString() ?? null,
      offerLetterSentAt: offer.offerLetterSentAt?.toISOString() ?? null,
      steps,
    };
  }

  async startForFilledLetter(
    companyId: string,
    offerId: string,
    userId?: string,
  ): Promise<OfferLetterApprovalStatus> {
    const defaults = await this.prisma.offerLetterTemplateApprover.findMany({
      where: { companyId },
      orderBy: { sequence: 'asc' },
      select: {
        sequence: true,
        positionId: true,
        employeeId: true,
      },
    });
    const usable = defaults.filter((step) => Boolean(step.employeeId));
    if (usable.length === 0) {
      await this.prisma.jobOfferOfferLetterApproval.deleteMany({
        where: { jobOfferId: offerId },
      });
      await this.prisma.jobOffer.update({
        where: { id: offerId },
        data: {
          offerLetterApprovalStatus: OfferLetterApprovalStatus.NOT_REQUIRED,
          offerLetterApprovalStartedAt: null,
          offerLetterApprovalCompletedAt: null,
        },
      });
      return OfferLetterApprovalStatus.NOT_REQUIRED;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.jobOfferOfferLetterApproval.deleteMany({
        where: { jobOfferId: offerId },
      });
      await tx.jobOfferOfferLetterApproval.createMany({
        data: usable.map((step, index) => ({
          companyId,
          jobOfferId: offerId,
          sequence: index + 1,
          positionId: step.positionId,
          approverEmployeeId: step.employeeId!,
          status: ApprovalStatus.PENDING,
          updatedAt: now,
        })),
      });
      await tx.jobOffer.update({
        where: { id: offerId },
        data: {
          offerLetterApprovalStatus: OfferLetterApprovalStatus.PENDING,
          offerLetterApprovalStartedAt: now,
          offerLetterApprovalCompletedAt: null,
          offerLetterSentAt: null,
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_LETTER_APPROVAL_STARTED,
      entity: 'JobOffer',
      entityId: offerId,
      company: { connect: { id: companyId } },
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      metadata: { offerId, stepCount: usable.length },
    });

    return OfferLetterApprovalStatus.PENDING;
  }

  async decide(
    companyId: string,
    userId: string,
    offerId: string,
    stepId: string,
    decision: 'APPROVE' | 'REJECT',
    comment?: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
      throw new ForbiddenException(
        'Debes estar vinculado como colaborador para aprobar la carta oferta',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.jobOffer.findFirst({
        where: { id: offerId, companyId },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      if (!offer.signedOfferLetterFileName) {
        throw new BadRequestException(OFFER_LETTER_ERRORS.SIGNED_NOT_FOUND);
      }
      if (
        offer.offerLetterApprovalStatus !== OfferLetterApprovalStatus.PENDING
      ) {
        throw new ConflictException(
          'El flujo de aprobación de carta oferta no está pendiente',
        );
      }

      const step = await tx.jobOfferOfferLetterApproval.findFirst({
        where: { id: stepId, companyId, jobOfferId: offerId },
      });
      if (!step) throw new NotFoundException('Approval step not found');
      if (step.status !== ApprovalStatus.PENDING) {
        throw new ConflictException('Este paso ya fue decidido');
      }
      if (step.approverEmployeeId !== employee.id) {
        throw new ForbiddenException(
          'No eres el aprobador asignado a este paso',
        );
      }

      const pendingBefore = await tx.jobOfferOfferLetterApproval.findMany({
        where: {
          jobOfferId: offerId,
          status: ApprovalStatus.PENDING,
        },
        orderBy: { sequence: 'asc' },
        select: { id: true, sequence: true },
      });
      if (pendingBefore[0]?.id !== step.id) {
        throw new BadRequestException(
          'Debes esperar a que se apruebe el paso anterior',
        );
      }

      const now = new Date();
      await tx.jobOfferOfferLetterApproval.update({
        where: { id: step.id },
        data: {
          status:
            decision === 'APPROVE'
              ? ApprovalStatus.APPROVED
              : ApprovalStatus.REJECTED,
          decidedAt: now,
          decidedByUserId: userId,
          comment: comment?.trim() || null,
        },
      });

      if (decision === 'REJECT') {
        await tx.jobOffer.update({
          where: { id: offerId },
          data: {
            offerLetterApprovalStatus: OfferLetterApprovalStatus.REJECTED,
            offerLetterApprovalCompletedAt: now,
          },
        });
        return {
          finalStatus: OfferLetterApprovalStatus.REJECTED,
          shouldSend: false,
        };
      }

      const stillPending = await tx.jobOfferOfferLetterApproval.count({
        where: {
          jobOfferId: offerId,
          status: ApprovalStatus.PENDING,
        },
      });
      if (stillPending === 0) {
        await tx.jobOffer.update({
          where: { id: offerId },
          data: {
            offerLetterApprovalStatus: OfferLetterApprovalStatus.APPROVED,
            offerLetterApprovalCompletedAt: now,
          },
        });
        return {
          finalStatus: OfferLetterApprovalStatus.APPROVED,
          shouldSend: true,
        };
      }

      return {
        finalStatus: OfferLetterApprovalStatus.PENDING,
        shouldSend: false,
      };
    });

    await this.audit.create({
      action:
        decision === 'APPROVE'
          ? ATS_AUDIT.OFFER_LETTER_APPROVAL_APPROVED
          : ATS_AUDIT.OFFER_LETTER_APPROVAL_REJECTED,
      entity: 'JobOfferOfferLetterApproval',
      entityId: stepId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        offerId,
        stepId,
        decision,
        finalStatus: result.finalStatus,
        comment: comment?.trim() || null,
      },
    });

    let send: Awaited<
      ReturnType<OfferLetterSendService['sendApprovedLetter']>
    > | null = null;
    if (result.shouldSend) {
      send = await this.send.sendApprovedLetter({
        companyId,
        userId,
        offerId,
        signerName: `${employee.firstName} ${employee.lastName}`.trim(),
      });
    }

    const snapshot = await this.getByOffer(companyId, offerId);
    return { ...snapshot, send };
  }

  private async requireOffer(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        id: true,
        applicationId: true,
        offerLetterApprovalStatus: true,
        offerLetterApprovalStartedAt: true,
        offerLetterApprovalCompletedAt: true,
        offerLetterSentAt: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }
}
