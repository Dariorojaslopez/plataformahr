import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  Prisma,
  VacancyApprovalStep,
  VacancyRequestStatus,
  VacancyStatus,
} from '@prisma/client';
import type { TenantContext } from '../../auth/auth.types';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  VACANCY_APPROVAL_ERRORS,
} from '../ats.constants';
import { PositionOccupantsService } from '../position-occupants/position-occupants.service';
import type { ReplacePositionOccupantStepsDto } from './dto/position-occupant-step.dto';

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const POSITION_SELECT = { id: true, name: true } as const;

@Injectable()
export class ActiveProcessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly occupants: PositionOccupantsService,
  ) {}

  async list(companyId: string) {
    const items = await this.prisma.vacancyRequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { status: VacancyRequestStatus.PENDING_APPROVAL },
          {
            status: VacancyRequestStatus.APPROVED,
            vacancy: { status: { in: [VacancyStatus.OPEN, VacancyStatus.PAUSED] } },
          },
        ],
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        existingPosition: { select: POSITION_SELECT },
        vacancy: { select: { id: true, title: true, status: true } },
        requestedByEmployee: { select: PERSON_SELECT },
      },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        title:
          item.vacancy?.title ??
          item.existingPosition?.name ??
          item.requestedPositionName ??
          'Proceso de selección',
        vacancyId: item.vacancy?.id ?? null,
        vacancyStatus: item.vacancy?.status ?? null,
        requestedByEmployee: item.requestedByEmployee,
      })),
    };
  }

  async getApprovals(companyId: string, requestId: string) {
    const request = await this.requireActive(companyId, requestId);
    const steps = await this.prisma.vacancyApproval.findMany({
      where: { companyId, vacancyRequestId: request.id },
      orderBy: { sequence: 'asc' },
      include: {
        position: { select: POSITION_SELECT },
        approverEmployee: { select: PERSON_SELECT },
      },
    });
    return {
      requestId: request.id,
      status: request.status,
      steps: steps.map((step) => ({
        ...step,
        locked:
          step.status === ApprovalStatus.APPROVED ||
          step.status === ApprovalStatus.REJECTED,
      })),
    };
  }

  async updateApprovals(
    tenant: TenantContext,
    requestId: string,
    dto: ReplacePositionOccupantStepsDto,
  ) {
    const request = await this.requireActive(tenant.companyId, requestId);
    if (request.status !== VacancyRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        VACANCY_APPROVAL_ERRORS.APPROVALS_NOT_EDITABLE,
      );
    }

    const existing = await this.prisma.vacancyApproval.findMany({
      where: { companyId: tenant.companyId, vacancyRequestId: request.id },
      orderBy: { sequence: 'asc' },
    });
    const locked = existing.filter(
      (step) =>
        step.status === ApprovalStatus.APPROVED ||
        step.status === ApprovalStatus.REJECTED,
    );
    if (dto.steps.length === 0) {
      throw new BadRequestException(
        VACANCY_APPROVAL_ERRORS.PENDING_STEP_REQUIRED,
      );
    }

    const pending: Prisma.VacancyApprovalCreateManyInput[] = [];
    for (const [index, step] of dto.steps.entries()) {
      const occupant = await this.occupants.resolve(
        tenant.companyId,
        step.positionId,
        step.employeeId,
      );
      pending.push({
        companyId: tenant.companyId,
        vacancyRequestId: request.id,
        step: VacancyApprovalStep.POSITION,
        sequence: locked.length + index + 1,
        label: null,
        positionId: step.positionId,
        approverEmployeeId: occupant.id,
        requiredRoleCode: null,
        status: ApprovalStatus.PENDING,
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.vacancyApproval.deleteMany({
        where: {
          companyId: tenant.companyId,
          vacancyRequestId: request.id,
          status: {
            in: [ApprovalStatus.PENDING, ApprovalStatus.SKIPPED],
          },
        },
      });
      if (pending.length > 0) {
        await tx.vacancyApproval.createMany({ data: pending });
      }
      return tx.vacancyApproval.findMany({
        where: { companyId: tenant.companyId, vacancyRequestId: request.id },
        orderBy: { sequence: 'asc' },
        include: {
          position: { select: POSITION_SELECT },
          approverEmployee: { select: PERSON_SELECT },
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_PROCESS_APPROVALS_UPDATED,
      entity: 'VacancyRequest',
      entityId: request.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { pendingCount: pending.length, lockedCount: locked.length },
    });

    return {
      requestId: request.id,
      status: request.status,
      steps: result.map((step) => ({
        ...step,
        locked:
          step.status === ApprovalStatus.APPROVED ||
          step.status === ApprovalStatus.REJECTED,
      })),
    };
  }

  async getEvaluators(companyId: string, requestId: string) {
    const request = await this.requireActive(companyId, requestId);
    const lockedIds = await this.evaluatedEmployeeIds(companyId, request.id);
    const steps = await this.prisma.vacancyRequestEvaluator.findMany({
      where: { companyId, vacancyRequestId: request.id },
      orderBy: { sequence: 'asc' },
      include: {
        position: { select: POSITION_SELECT },
        employee: { select: PERSON_SELECT },
      },
    });
    return {
      requestId: request.id,
      status: request.status,
      steps: steps.map((step) => ({
        ...step,
        locked: lockedIds.has(step.employeeId),
      })),
    };
  }

  async updateEvaluators(
    tenant: TenantContext,
    requestId: string,
    dto: ReplacePositionOccupantStepsDto,
  ) {
    const request = await this.requireActive(tenant.companyId, requestId);
    const lockedIds = await this.evaluatedEmployeeIds(
      tenant.companyId,
      request.id,
    );
    const existing = await this.prisma.vacancyRequestEvaluator.findMany({
      where: { companyId: tenant.companyId, vacancyRequestId: request.id },
    });
    const existingLocked = existing.filter((step) =>
      lockedIds.has(step.employeeId),
    );

    const incoming: Prisma.VacancyRequestEvaluatorCreateManyInput[] = [];
    for (const [index, step] of dto.steps.entries()) {
      const occupant = await this.occupants.resolve(
        tenant.companyId,
        step.positionId,
        step.employeeId,
      );
      incoming.push({
        companyId: tenant.companyId,
        vacancyRequestId: request.id,
        sequence: index + 1,
        positionId: step.positionId,
        employeeId: occupant.id,
        updatedAt: new Date(),
      });
    }

    for (const locked of existingLocked) {
      const next = incoming.find((step) => step.employeeId === locked.employeeId);
      if (!next) {
        throw new BadRequestException(
          VACANCY_APPROVAL_ERRORS.CANNOT_REMOVE_EVALUATOR,
        );
      }
      if (next.positionId !== locked.positionId) {
        throw new BadRequestException(
          VACANCY_APPROVAL_ERRORS.EVALUATOR_ALREADY_EVALUATED,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.vacancyRequestEvaluator.deleteMany({
        where: { companyId: tenant.companyId, vacancyRequestId: request.id },
      });
      if (incoming.length > 0) {
        await tx.vacancyRequestEvaluator.createMany({ data: incoming });
      }
      return tx.vacancyRequestEvaluator.findMany({
        where: { companyId: tenant.companyId, vacancyRequestId: request.id },
        orderBy: { sequence: 'asc' },
        include: {
          position: { select: POSITION_SELECT },
          employee: { select: PERSON_SELECT },
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_PROCESS_EVALUATORS_UPDATED,
      entity: 'VacancyRequest',
      entityId: request.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { stepCount: result.length },
    });

    return {
      requestId: request.id,
      status: request.status,
      steps: result.map((step) => ({
        ...step,
        locked: lockedIds.has(step.employeeId),
      })),
    };
  }

  private async requireActive(companyId: string, requestId: string) {
    const request = await this.prisma.vacancyRequest.findFirst({
      where: { id: requestId, companyId, deletedAt: null },
      include: { vacancy: { select: { status: true } } },
    });
    if (!request) {
      throw new NotFoundException('Vacancy request not found');
    }
    const active =
      request.status === VacancyRequestStatus.PENDING_APPROVAL ||
      (request.status === VacancyRequestStatus.APPROVED &&
        (request.vacancy?.status === VacancyStatus.OPEN ||
          request.vacancy?.status === VacancyStatus.PAUSED));
    if (!active) {
      throw new BadRequestException(VACANCY_APPROVAL_ERRORS.PROCESS_NOT_ACTIVE);
    }
    return request;
  }

  private async evaluatedEmployeeIds(
    companyId: string,
    vacancyRequestId: string,
  ) {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { vacancyRequestId },
      select: { id: true },
    });
    if (!vacancy) {
      return new Set<string>();
    }
    const answers = await this.prisma.interviewAnswer.findMany({
      where: {
        companyId,
        interviewQuestion: {
          interview: {
            deletedAt: null,
            application: { vacancyId: vacancy.id },
          },
        },
      },
      select: { answeredByUserId: true },
    });
    const userIds = [...new Set(answers.map((item) => item.answeredByUserId))];
    if (userIds.length === 0) {
      return new Set<string>();
    }
    const employees = await this.prisma.employee.findMany({
      where: { companyId, userId: { in: userIds }, deletedAt: null },
      select: { id: true },
    });
    return new Set(employees.map((item) => item.id));
  }
}
