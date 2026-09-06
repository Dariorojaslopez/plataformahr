import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ContractApprovalStatus,
  JobOfferStatus,
  type Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';

const STEP_INCLUDE = {
  position: { select: { id: true, name: true } },
  approverEmployee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class ContractApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getByOffer(companyId: string, offerId: string) {
    const offer = await this.requireOffer(companyId, offerId);
    const steps = await this.prisma.jobOfferContractApproval.findMany({
      where: { companyId, jobOfferId: offerId },
      orderBy: { sequence: 'asc' },
      include: STEP_INCLUDE,
    });
    return {
      offerId,
      applicationId: offer.applicationId,
      offerStatus: offer.status,
      contractApprovalStatus: offer.contractApprovalStatus,
      contractApprovalStartedAt:
        offer.contractApprovalStartedAt?.toISOString() ?? null,
      contractApprovalCompletedAt:
        offer.contractApprovalCompletedAt?.toISOString() ?? null,
      steps,
      readyForHire: this.isReadyForHire(offer.contractApprovalStatus),
    };
  }

  /**
   * Called after offer accept. Snapshots company template approvers.
   * No configured steps → NOT_REQUIRED.
   */
  async startForAcceptedOffer(
    tx: Prisma.TransactionClient,
    input: { companyId: string; offerId: string },
  ): Promise<ContractApprovalStatus> {
    const defaults = await tx.contractTemplateApprover.findMany({
      where: { companyId: input.companyId },
      orderBy: { sequence: 'asc' },
      select: {
        sequence: true,
        positionId: true,
        employeeId: true,
      },
    });

    const usable = defaults.filter((step) => Boolean(step.employeeId));
    if (usable.length === 0) {
      await tx.jobOffer.update({
        where: { id: input.offerId },
        data: {
          contractApprovalStatus: ContractApprovalStatus.NOT_REQUIRED,
          contractApprovalStartedAt: null,
          contractApprovalCompletedAt: null,
        },
      });
      return ContractApprovalStatus.NOT_REQUIRED;
    }

    await tx.jobOfferContractApproval.deleteMany({
      where: { jobOfferId: input.offerId },
    });

    const now = new Date();
    await tx.jobOfferContractApproval.createMany({
      data: usable.map((step, index) => ({
        companyId: input.companyId,
        jobOfferId: input.offerId,
        sequence: index + 1,
        positionId: step.positionId,
        approverEmployeeId: step.employeeId!,
        status: ApprovalStatus.PENDING,
        updatedAt: now,
      })),
    });

    await tx.jobOffer.update({
      where: { id: input.offerId },
      data: {
        contractApprovalStatus: ContractApprovalStatus.PENDING,
        contractApprovalStartedAt: now,
        contractApprovalCompletedAt: null,
      },
    });

    return ContractApprovalStatus.PENDING;
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
      select: { id: true },
    });
    if (!employee) {
      throw new ForbiddenException(
        'Debes estar vinculado como colaborador para aprobar el contrato',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.jobOffer.findFirst({
        where: { id: offerId, companyId },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      if (offer.status !== JobOfferStatus.ACCEPTED) {
        throw new BadRequestException(
          'La oferta debe estar aceptada para aprobar el contrato',
        );
      }
      if (offer.contractApprovalStatus !== ContractApprovalStatus.PENDING) {
        throw new ConflictException(
          'El flujo de aprobación de contrato no está pendiente',
        );
      }

      const step = await tx.jobOfferContractApproval.findFirst({
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

      const pendingBefore = await tx.jobOfferContractApproval.findMany({
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
      await tx.jobOfferContractApproval.update({
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
            contractApprovalStatus: ContractApprovalStatus.REJECTED,
            contractApprovalCompletedAt: now,
          },
        });
        return { finalStatus: ContractApprovalStatus.REJECTED };
      }

      const stillPending = await tx.jobOfferContractApproval.count({
        where: {
          jobOfferId: offerId,
          status: ApprovalStatus.PENDING,
        },
      });
      if (stillPending === 0) {
        await tx.jobOffer.update({
          where: { id: offerId },
          data: {
            contractApprovalStatus: ContractApprovalStatus.APPROVED,
            contractApprovalCompletedAt: now,
          },
        });
        return { finalStatus: ContractApprovalStatus.APPROVED };
      }

      return { finalStatus: ContractApprovalStatus.PENDING };
    });

    await this.audit.create({
      action:
        decision === 'APPROVE'
          ? ATS_AUDIT.CONTRACT_APPROVAL_APPROVED
          : ATS_AUDIT.CONTRACT_APPROVAL_REJECTED,
      entity: 'JobOfferContractApproval',
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

    return this.getByOffer(companyId, offerId);
  }

  isReadyForHire(status: ContractApprovalStatus | string): boolean {
    return (
      status === ContractApprovalStatus.APPROVED ||
      status === ContractApprovalStatus.NOT_REQUIRED
    );
  }

  private async requireOffer(companyId: string, offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, companyId },
      select: {
        id: true,
        applicationId: true,
        status: true,
        contractApprovalStatus: true,
        contractApprovalStartedAt: true,
        contractApprovalCompletedAt: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }
}
