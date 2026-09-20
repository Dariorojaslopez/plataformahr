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
  type Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { CONTRACT_ERRORS } from './contract.constants';
import { ContractSendService } from './contract-send.service';

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
    private readonly send: ContractSendService,
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
   * Called after the recruiter uploads the filled contract.
   * Snapshots company template approvers. No configured steps → NOT_REQUIRED.
   */
  async startForFilledContract(
    companyId: string,
    offerId: string,
    userId?: string,
  ): Promise<ContractApprovalStatus> {
    const defaults = await this.prisma.contractTemplateApprover.findMany({
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
      await this.prisma.jobOfferContractApproval.deleteMany({
        where: { jobOfferId: offerId },
      });
      await this.prisma.jobOffer.update({
        where: { id: offerId },
        data: {
          contractApprovalStatus: ContractApprovalStatus.NOT_REQUIRED,
          contractApprovalStartedAt: null,
          contractApprovalCompletedAt: null,
        },
      });
      return ContractApprovalStatus.NOT_REQUIRED;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.jobOfferContractApproval.deleteMany({
        where: { jobOfferId: offerId },
      });
      await tx.jobOfferContractApproval.createMany({
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
          contractApprovalStatus: ContractApprovalStatus.PENDING,
          contractApprovalStartedAt: now,
          contractApprovalCompletedAt: null,
          contractSentAt: null,
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.CONTRACT_APPROVAL_STARTED,
      entity: 'JobOffer',
      entityId: offerId,
      company: { connect: { id: companyId } },
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      metadata: { offerId, stepCount: usable.length },
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
      select: { id: true, firstName: true, lastName: true },
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
      if (!offer.signedContractFileName) {
        throw new BadRequestException(CONTRACT_ERRORS.SIGNED_NOT_FOUND);
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
        return { finalStatus: ContractApprovalStatus.REJECTED, shouldSend: false };
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
        return { finalStatus: ContractApprovalStatus.APPROVED, shouldSend: true };
      }

      return { finalStatus: ContractApprovalStatus.PENDING, shouldSend: false };
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

    let send: Awaited<
      ReturnType<ContractSendService['sendApprovedContract']>
    > | null = null;
    if (result.shouldSend) {
      send = await this.send.sendApprovedContract({
        companyId,
        userId,
        offerId,
        signerName: `${employee.firstName} ${employee.lastName}`.trim(),
      });
    }

    const snapshot = await this.getByOffer(companyId, offerId);
    return { ...snapshot, send };
  }

  isReadyForHire(status: ContractApprovalStatus): boolean {
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
