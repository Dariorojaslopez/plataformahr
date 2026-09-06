import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  OrganizationEntityStatus,
  Prisma,
  VacancyApprovalPlanOrigin,
  VacancyApprovalStep,
  VacancyRequestMotive,
  VacancyRequestStatus,
  VacancyRequestType,
  VacancyStatus,
  type VacancyRequest,
} from '@prisma/client';
import type { TenantContext } from '../../auth/auth.types';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { OrganizationIntegrityService } from '../../organization/organization-integrity.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  DEFAULT_VACANCY_HIRING_SLA_DAYS,
  MAX_LIMIT,
  MAX_VACANCY_APPROVAL_STEPS,
  PROXY_REQUESTER_ROLE_CODES,
  VACANCY_REQUESTER_ERRORS,
} from '../ats.constants';
import type {
  ApprovalDecisionDto,
  CreateVacancyRequestDto,
  ListVacancyRequestsQueryDto,
  RejectDecisionDto,
  UpdateVacancyRequestDto,
} from './dto/vacancy-request.dto';
import {
  canDecideStep,
  currentPendingStep,
  type ApprovalActor,
} from './vacancy-approval.helpers';
import { VacancyApprovalWorkflowService } from './vacancy-approval-workflow.service';
import { VacancyEvaluatorDefaultsService } from '../process-defaults/vacancy-evaluator-defaults.service';
import { PositionOccupantsService } from '../position-occupants/position-occupants.service';
import {
  defaultMotiveFromType,
  isReplacementMotive,
  minExpectedHiringDate,
  parseDateOnlyUtc,
  typeFromMotive,
} from './vacancy-request-motive';

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const PLAN_INCLUDE = {
  orderBy: { sequence: 'asc' as const },
  include: {
    position: { select: { id: true, name: true } },
    specificEmployee: { select: PERSON_SELECT },
  },
} as const;

const APPROVAL_INCLUDE = {
  orderBy: { sequence: 'asc' as const },
  include: {
    approverEmployee: {
      select: PERSON_SELECT,
    },
    decidedByUser: {
      select: { id: true, firstName: true, lastName: true },
    },
  },
};

@Injectable()
export class VacancyRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
    private readonly rbac: RbacService,
    private readonly workflow: VacancyApprovalWorkflowService,
    private readonly evaluatorDefaults: VacancyEvaluatorDefaultsService,
    private readonly occupants: PositionOccupantsService,
  ) {}

  async list(tenant: TenantContext, query: ListVacancyRequestsQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const actor = await this.resolveActor(tenant);

    const where: Prisma.VacancyRequestWhereInput = {
      companyId: tenant.companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.pendingMyApproval
        ? { status: VacancyRequestStatus.PENDING_APPROVAL }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.motive ? { motive: query.motive } : {}),
      ...(query.requestedByEmployeeId
        ? { requestedByEmployeeId: query.requestedByEmployeeId }
        : {}),
      ...(search
        ? {
            OR: [
              {
                requestedPositionName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                existingPosition: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    if (query.pendingMyApproval) {
      const pending = await this.prisma.vacancyRequest.findMany({
        where,
        include: {
          existingPosition: {
            select: { id: true, name: true, headcount: true },
          },
          requestedArea: { select: { id: true, name: true } },
          requestedByEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          replacedEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvals: APPROVAL_INCLUDE,
          approvalPlanSteps: PLAN_INCLUDE,
        },
        orderBy: { createdAt: 'desc' },
      });
      const mine = pending.filter((item) =>
        this.userCanDecideCurrentStep(item.status, item.approvals, actor),
      );
      const items = mine
        .slice(skip, skip + limit)
        .map((item) => this.withDecisionFlag(item, actor));
      return {
        items,
        page,
        limit,
        total: mine.length,
        totalPages: Math.ceil(mine.length / limit) || 1,
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vacancyRequest.findMany({
        where,
        include: {
          existingPosition: {
            select: { id: true, name: true, headcount: true },
          },
          requestedArea: { select: { id: true, name: true } },
          requestedByEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          replacedEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvals: APPROVAL_INCLUDE,
          approvalPlanSteps: PLAN_INCLUDE,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vacancyRequest.count({ where }),
    ]);

    return {
      items: items.map((item) => this.withDecisionFlag(item, actor)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(tenant: TenantContext, id: string) {
    const request = await this.prisma.vacancyRequest.findFirst({
      where: { id, companyId: tenant.companyId, deletedAt: null },
      include: {
        existingPosition: true,
        requestedArea: true,
        requestedJobLevel: true,
        requestedByEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        replacedEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvals: APPROVAL_INCLUDE,
        approvalPlanSteps: PLAN_INCLUDE,
        vacancy: true,
      },
    });
    if (!request) {
      throw new NotFoundException('Vacancy request not found');
    }
    const actor = await this.resolveActor(tenant);
    return this.withDecisionFlag(request, actor);
  }

  async create(
    tenant: TenantContext,
    dto: CreateVacancyRequestDto,
  ): Promise<VacancyRequest> {
    const requestedByEmployeeId = await this.resolveRequesterEmployeeId(
      tenant,
      dto.requestedByEmployeeId,
    );
    this.rejectExtraApprovalSteps(dto.extraApprovalSteps);
    const resolved = this.resolveMotiveAndType(dto.motive, dto.type);
    await this.validateRequestShape(tenant.companyId, {
      ...dto,
      ...resolved,
      justification: dto.justification ?? '',
      expectedHiringDate: dto.expectedHiringDate,
      replacedEmployeeId: dto.replacedEmployeeId,
    });

    const created = await this.prisma.vacancyRequest.create({
      data: this.toCreateData(
        tenant.companyId,
        requestedByEmployeeId,
        dto,
        resolved,
      ),
    });
    await this.seedApprovalPlan(tenant.companyId, created.id);

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_REQUEST_CREATED,
      entity: 'VacancyRequest',
      entityId: created.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: {
        id: created.id,
        status: created.status,
        type: created.type,
        motive: created.motive,
      },
    });

    return created;
  }

  async update(
    tenant: TenantContext,
    id: string,
    dto: UpdateVacancyRequestDto,
  ): Promise<VacancyRequest> {
    const existing = await this.requireDraft(tenant.companyId, id);
    this.rejectExtraApprovalSteps(dto.extraApprovalSteps);

    const resolved = this.resolveMotiveAndType(
      dto.motive ?? existing.motive,
      dto.type ?? existing.type,
    );
    const shape = {
      type: resolved.type,
      motive: resolved.motive,
      existingPositionId:
        dto.existingPositionId !== undefined
          ? dto.existingPositionId
          : existing.existingPositionId,
      requestedPositionName:
        dto.requestedPositionName !== undefined
          ? dto.requestedPositionName
          : existing.requestedPositionName,
      requestedAreaId:
        dto.requestedAreaId !== undefined
          ? dto.requestedAreaId
          : existing.requestedAreaId,
      requestedJobLevelId:
        dto.requestedJobLevelId !== undefined
          ? dto.requestedJobLevelId
          : existing.requestedJobLevelId,
      replacedEmployeeId:
        dto.replacedEmployeeId !== undefined
          ? dto.replacedEmployeeId
          : existing.replacedEmployeeId,
      requestedHeadcount: dto.requestedHeadcount ?? existing.requestedHeadcount,
      expectedHiringDate:
        dto.expectedHiringDate ??
        existing.expectedHiringDate.toISOString().slice(0, 10),
      justification: dto.justification ?? existing.justification,
      generalManagerApprovalRequired:
        dto.generalManagerApprovalRequired ??
        existing.generalManagerApprovalRequired,
    };

    if (dto.requestedByEmployeeId) {
      await this.resolveRequesterEmployeeId(tenant, dto.requestedByEmployeeId);
    }
    await this.validateRequestShape(tenant.companyId, shape);

    const expectedHiringDate = parseDateOnlyUtc(shape.expectedHiringDate)!;

    const updated = await this.prisma.vacancyRequest.update({
      where: { id },
      data: {
        type: resolved.type,
        motive: resolved.motive,
        ...(dto.requestedByEmployeeId !== undefined
          ? { requestedByEmployeeId: dto.requestedByEmployeeId }
          : {}),
        ...(dto.requestedHeadcount !== undefined
          ? { requestedHeadcount: dto.requestedHeadcount }
          : {}),
        expectedHiringDate,
        ...(dto.justification !== undefined
          ? { justification: dto.justification.trim() }
          : {}),
        ...(dto.generalManagerApprovalRequired !== undefined
          ? {
              generalManagerApprovalRequired:
                dto.generalManagerApprovalRequired,
            }
          : {}),
        replacedEmployeeId: isReplacementMotive(resolved.motive)
          ? (shape.replacedEmployeeId ?? null)
          : null,
        ...this.shapeFieldsForType(resolved.type, shape),
      } satisfies Prisma.VacancyRequestUncheckedUpdateInput,
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_REQUEST_UPDATED,
      entity: 'VacancyRequest',
      entityId: updated.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { id: updated.id, status: updated.status },
    });

    return updated;
  }

  async submit(tenant: TenantContext, id: string) {
    const request = await this.requireDraft(tenant.companyId, id);
    await this.validateRequestShape(tenant.companyId, {
      type: request.type,
      motive: request.motive,
      existingPositionId: request.existingPositionId,
      requestedPositionName: request.requestedPositionName,
      requestedAreaId: request.requestedAreaId,
      requestedJobLevelId: request.requestedJobLevelId,
      replacedEmployeeId: request.replacedEmployeeId,
      requestedHeadcount: request.requestedHeadcount,
      expectedHiringDate: request.expectedHiringDate.toISOString().slice(0, 10),
      justification: request.justification,
      generalManagerApprovalRequired: request.generalManagerApprovalRequired,
    });

    const plan = await this.prisma.vacancyRequestApprovalPlanStep.findMany({
      where: { companyId: tenant.companyId, vacancyRequestId: id },
      orderBy: { sequence: 'asc' },
    });
    const approvalsData =
      plan.length > 0
        ? await this.workflow.snapshotFromSteps(
            {
              companyId: tenant.companyId,
              vacancyRequestId: id,
              requestedByEmployeeId: request.requestedByEmployeeId,
            },
            plan,
          )
        : await this.workflow.buildSnapshot({
            companyId: tenant.companyId,
            vacancyRequestId: id,
            requestedByEmployeeId: request.requestedByEmployeeId,
            generalManagerApprovalRequired: request.generalManagerApprovalRequired,
          });
    const evaluatorsData = await this.evaluatorDefaults.buildSnapshot(
      tenant.companyId,
      id,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const transition = await tx.vacancyRequest.updateMany({
        where: {
          id,
          companyId: tenant.companyId,
          status: VacancyRequestStatus.DRAFT,
          deletedAt: null,
        },
        data: {
          status: VacancyRequestStatus.PENDING_APPROVAL,
          submittedAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Vacancy request is not in DRAFT status');
      }

      await tx.vacancyApproval.createMany({ data: approvalsData });
      if (evaluatorsData.length > 0) {
        await tx.vacancyRequestEvaluator.createMany({ data: evaluatorsData });
      }

      return tx.vacancyRequest.findFirstOrThrow({
        where: { id, companyId: tenant.companyId },
        include: {
          approvals: APPROVAL_INCLUDE,
          approvalPlanSteps: PLAN_INCLUDE,
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_REQUEST_SUBMITTED,
      entity: 'VacancyRequest',
      entityId: id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: {
        id,
        status: VacancyRequestStatus.PENDING_APPROVAL,
        steps: approvalsData.map((step) => ({
          sequence: step.sequence,
          step: step.step,
        })),
      },
    });

    const actor = await this.resolveActor(tenant);
    return this.withDecisionFlag(result, actor);
  }

  async approve(tenant: TenantContext, id: string, dto: ApprovalDecisionDto) {
    return this.decide(tenant, id, 'approve', dto.comment);
  }

  async reject(tenant: TenantContext, id: string, dto: RejectDecisionDto) {
    return this.decide(tenant, id, 'reject', dto.comment);
  }

  private async decide(
    tenant: TenantContext,
    id: string,
    decision: 'approve' | 'reject',
    comment?: string,
  ) {
    const request = await this.prisma.vacancyRequest.findFirst({
      where: {
        id,
        companyId: tenant.companyId,
        deletedAt: null,
        status: VacancyRequestStatus.PENDING_APPROVAL,
      },
      include: { approvals: APPROVAL_INCLUDE },
    });
    if (!request) {
      throw new NotFoundException('Vacancy request not found or not pending');
    }

    const current = currentPendingStep(request.approvals);
    if (!current) {
      throw new ConflictException('No pending approval step');
    }

    const actor = await this.resolveActor(tenant);
    this.assertCanDecideStep(current, actor);

    if (decision === 'reject') {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const stepUpdate = await tx.vacancyApproval.updateMany({
          where: {
            id: current.id,
            companyId: tenant.companyId,
            status: ApprovalStatus.PENDING,
          },
          data: {
            status: ApprovalStatus.REJECTED,
            decidedByUserId: tenant.userId,
            decidedAt: new Date(),
            comment: comment?.trim() ?? null,
          },
        });
        if (stepUpdate.count !== 1) {
          throw new ConflictException('Approval step already decided');
        }

        const requestUpdate = await tx.vacancyRequest.updateMany({
          where: {
            id,
            companyId: tenant.companyId,
            status: VacancyRequestStatus.PENDING_APPROVAL,
          },
          data: {
            status: VacancyRequestStatus.REJECTED,
            rejectedAt: new Date(),
          },
        });
        if (requestUpdate.count !== 1) {
          throw new ConflictException('Vacancy request is no longer pending');
        }

        await tx.vacancyApproval.updateMany({
          where: {
            vacancyRequestId: id,
            companyId: tenant.companyId,
            status: ApprovalStatus.PENDING,
            sequence: { gt: current.sequence },
          },
          data: { status: ApprovalStatus.SKIPPED },
        });

        return tx.vacancyRequest.findFirstOrThrow({
          where: { id, companyId: tenant.companyId },
          include: {
          approvals: APPROVAL_INCLUDE,
          approvalPlanSteps: PLAN_INCLUDE,
        },
        });
      });

      await this.audit.create({
        action: ATS_AUDIT.VACANCY_REQUEST_REJECTED,
        entity: 'VacancyRequest',
        entityId: id,
        company: { connect: { id: tenant.companyId } },
        user: { connect: { id: tenant.userId } },
        metadata: {
          id,
          step: current.step,
          sequence: current.sequence,
          status: VacancyRequestStatus.REJECTED,
          comment: comment?.trim() ?? null,
        },
      });

      return this.withDecisionFlag(rejected, actor);
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const stepUpdate = await tx.vacancyApproval.updateMany({
        where: {
          id: current.id,
          companyId: tenant.companyId,
          status: ApprovalStatus.PENDING,
        },
        data: {
          status: ApprovalStatus.APPROVED,
          decidedByUserId: tenant.userId,
          decidedAt: new Date(),
          comment: comment?.trim() ?? null,
        },
      });
      if (stepUpdate.count !== 1) {
        throw new ConflictException('Approval step already decided');
      }

      const remaining = await tx.vacancyApproval.count({
        where: {
          vacancyRequestId: id,
          companyId: tenant.companyId,
          status: ApprovalStatus.PENDING,
        },
      });

      if (remaining > 0) {
        return tx.vacancyRequest.findFirstOrThrow({
          where: { id, companyId: tenant.companyId },
          include: {
            approvals: APPROVAL_INCLUDE,
            approvalPlanSteps: PLAN_INCLUDE,
            vacancy: true,
          },
        });
      }

      const finalize = await tx.vacancyRequest.updateMany({
        where: {
          id,
          companyId: tenant.companyId,
          status: VacancyRequestStatus.PENDING_APPROVAL,
        },
        data: {
          status: VacancyRequestStatus.APPROVED,
          approvedAt: new Date(),
        },
      });
      if (finalize.count !== 1) {
        throw new ConflictException('Vacancy request already finalized');
      }

      await this.createVacancyFromApprovedRequest(tx, tenant.companyId, id);

      return tx.vacancyRequest.findFirstOrThrow({
        where: { id, companyId: tenant.companyId },
        include: {
          approvals: APPROVAL_INCLUDE,
          approvalPlanSteps: PLAN_INCLUDE,
          vacancy: true,
        },
      });
    });

    const fullyApproved = approved.status === VacancyRequestStatus.APPROVED;

    await this.audit.create({
      action: fullyApproved
        ? ATS_AUDIT.VACANCY_REQUEST_APPROVED
        : ATS_AUDIT.VACANCY_REQUEST_APPROVED_STEP,
      entity: 'VacancyRequest',
      entityId: id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: {
        id,
        step: current.step,
        sequence: current.sequence,
        status: approved.status,
      },
    });

    if (fullyApproved && approved.vacancy) {
      await this.audit.create({
        action: ATS_AUDIT.VACANCY_CREATED,
        entity: 'Vacancy',
        entityId: approved.vacancy.id,
        company: { connect: { id: tenant.companyId } },
        user: { connect: { id: tenant.userId } },
        metadata: {
          id: approved.vacancy.id,
          vacancyRequestId: id,
        },
      });
    }

    return this.withDecisionFlag(approved, actor);
  }

  private async createVacancyFromApprovedRequest(
    tx: Prisma.TransactionClient,
    companyId: string,
    requestId: string,
  ): Promise<void> {
    const request = await tx.vacancyRequest.findFirstOrThrow({
      where: { id: requestId, companyId },
    });

    let positionId: string;
    let areaId: string;
    let title: string;

    if (request.type === VacancyRequestType.EXISTING_POSITION) {
      if (!request.existingPositionId) {
        throw new BadRequestException('Missing existing position');
      }
      const position = await tx.position.findFirst({
        where: {
          id: request.existingPositionId,
          companyId,
          deletedAt: null,
        },
      });
      if (!position) {
        throw new NotFoundException('Existing position not found');
      }

      // Replacements fill existing capacity. Only grow structure when the
      // requested openings exceed the approved headcount (justified excess).
      if (request.requestedHeadcount > position.headcount) {
        await tx.position.update({
          where: { id: position.id },
          data: { headcount: request.requestedHeadcount },
        });
      }

      positionId = position.id;
      areaId = position.areaId;
      title = position.name;
    } else {
      if (!request.requestedPositionName || !request.requestedAreaId) {
        throw new BadRequestException('Missing new position fields');
      }
      const area = await tx.area.findFirst({
        where: {
          id: request.requestedAreaId,
          companyId,
          deletedAt: null,
        },
      });
      if (!area) {
        throw new NotFoundException('Requested area not found');
      }
      if (request.requestedJobLevelId) {
        const jobLevel = await tx.jobLevel.findFirst({
          where: {
            id: request.requestedJobLevelId,
            companyId,
            deletedAt: null,
          },
        });
        if (!jobLevel) {
          throw new NotFoundException('Requested job level not found');
        }
      }

      try {
        const createdPosition = await tx.position.create({
          data: {
            companyId,
            name: request.requestedPositionName.trim(),
            areaId: request.requestedAreaId,
            jobLevelId: request.requestedJobLevelId,
            headcount: request.requestedHeadcount,
            status: OrganizationEntityStatus.ACTIVE,
          },
        });
        positionId = createdPosition.id;
        areaId = createdPosition.areaId;
        title = createdPosition.name;
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'A position with the same name already exists in this company',
          );
        }
        throw error;
      }
    }

    try {
      await tx.vacancy.create({
        data: {
          companyId,
          vacancyRequestId: request.id,
          positionId,
          areaId,
          title,
          headcount: request.requestedHeadcount,
          filledCount: 0,
          status: VacancyStatus.OPEN,
          openedAt: new Date(),
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Vacancy already exists for this request');
      }
      throw error;
    }
  }

  private assertCanDecideStep(
    step: {
      step: VacancyApprovalStep;
      approverEmployeeId: string | null;
      requiredRoleCode: string | null;
    },
    actor: ApprovalActor,
  ): void {
    if (canDecideStep(step, actor)) {
      return;
    }
    if (
      step.step === VacancyApprovalStep.DIRECT_MANAGER ||
      step.step === VacancyApprovalStep.SPECIFIC_EMPLOYEE
    ) {
      throw new ForbiddenException(
        'Only the assigned approver can decide this step',
      );
    }
    if (!step.requiredRoleCode) {
      throw new ForbiddenException('Required role is not configured');
    }
    throw new ForbiddenException(
      `Membership must have role ${step.requiredRoleCode} for this step`,
    );
  }

  private async resolveActor(tenant: TenantContext): Promise<ApprovalActor> {
    const [roleCodes, employee] = await Promise.all([
      this.rbac.getRoleCodesForMembership(tenant.membershipId),
      this.prisma.employee.findFirst({
        where: {
          companyId: tenant.companyId,
          userId: tenant.userId,
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    return {
      roleCodes,
      userEmployeeId: employee?.id ?? null,
    };
  }

  private userCanDecideCurrentStep(
    status: VacancyRequestStatus,
    approvals: Parameters<typeof currentPendingStep>[0],
    actor: ApprovalActor,
  ): boolean {
    if (status !== VacancyRequestStatus.PENDING_APPROVAL) {
      return false;
    }
    const current = currentPendingStep(approvals);
    return current !== null && canDecideStep(current, actor);
  }

  private withDecisionFlag<
    T extends {
      status: VacancyRequestStatus;
      approvals: Parameters<typeof currentPendingStep>[0];
    },
  >(request: T, actor: ApprovalActor): T & { currentUserCanDecide: boolean } {
    return {
      ...request,
      currentUserCanDecide: this.userCanDecideCurrentStep(
        request.status,
        request.approvals,
        actor,
      ),
    };
  }

  private async resolveRequesterEmployeeId(
    tenant: TenantContext,
    requestedByEmployeeId?: string,
  ): Promise<string> {
    const roleCodes = await this.rbac.getRoleCodesForMembership(
      tenant.membershipId,
    );
    const canProxy = PROXY_REQUESTER_ROLE_CODES.some((code) =>
      roleCodes.has(code),
    );

    if (requestedByEmployeeId) {
      await this.integrity.requireEmployee(
        tenant.companyId,
        requestedByEmployeeId,
      );
      if (!canProxy) {
        const own = await this.prisma.employee.findFirst({
          where: {
            id: requestedByEmployeeId,
            companyId: tenant.companyId,
            userId: tenant.userId,
            deletedAt: null,
          },
        });
        if (!own) {
          throw new ForbiddenException(VACANCY_REQUESTER_ERRORS.CANNOT_PROXY);
        }
      }
      return requestedByEmployeeId;
    }

    const ownEmployee = await this.prisma.employee.findFirst({
      where: {
        companyId: tenant.companyId,
        userId: tenant.userId,
        deletedAt: null,
      },
    });
    if (!ownEmployee) {
      throw new BadRequestException(
        canProxy
          ? VACANCY_REQUESTER_ERRORS.SELECT_REQUESTER
          : VACANCY_REQUESTER_ERRORS.NO_LINKED_EMPLOYEE,
      );
    }
    return ownEmployee.id;
  }

  private rejectExtraApprovalSteps(
    steps: Array<{ positionId: string; employeeId?: string | null }> | undefined,
  ): void {
    if (steps && steps.length > 0) {
      throw new BadRequestException(
        'Los niveles de aprobación son los preestablecidos; no se pueden agregar extras en la solicitud.',
      );
    }
  }

  private resolveMotiveAndType(
    motive?: VacancyRequestMotive | null,
    type?: VacancyRequestType | null,
  ): { motive: VacancyRequestMotive; type: VacancyRequestType } {
    if (motive) {
      const derivedType = typeFromMotive(motive);
      if (type && type !== derivedType) {
        throw new BadRequestException(
          'motive and type are inconsistent',
        );
      }
      return { motive, type: derivedType };
    }
    if (type) {
      return { type, motive: defaultMotiveFromType(type) };
    }
    throw new BadRequestException('motive or type is required');
  }

  private async validateRequestShape(
    companyId: string,
    dto: {
      type: VacancyRequestType;
      motive: VacancyRequestMotive;
      existingPositionId?: string | null;
      requestedPositionName?: string | null;
      requestedAreaId?: string | null;
      requestedJobLevelId?: string | null;
      replacedEmployeeId?: string | null;
      requestedHeadcount: number;
      expectedHiringDate: string;
      justification?: string | null;
      generalManagerApprovalRequired?: boolean;
    },
  ): Promise<void> {
    if (dto.requestedHeadcount < 1) {
      throw new BadRequestException('requestedHeadcount must be >= 1');
    }

    const expectedHiringDate = parseDateOnlyUtc(dto.expectedHiringDate);
    if (!expectedHiringDate) {
      throw new BadRequestException('expectedHiringDate is invalid');
    }
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { vacancyHiringSlaDays: true },
    });
    const slaDays =
      company?.vacancyHiringSlaDays ?? DEFAULT_VACANCY_HIRING_SLA_DAYS;
    const minDate = minExpectedHiringDate(slaDays);
    if (expectedHiringDate.getTime() < minDate.getTime()) {
      throw new BadRequestException(
        `expectedHiringDate must be on or after ${minDate.toISOString().slice(0, 10)} (SLA ${slaDays} days)`,
      );
    }

    if (dto.type === VacancyRequestType.EXISTING_POSITION) {
      if (!dto.existingPositionId) {
        throw new BadRequestException(
          'existingPositionId is required for EXISTING_POSITION',
        );
      }
      if (
        dto.requestedPositionName ||
        dto.requestedAreaId ||
        dto.requestedJobLevelId
      ) {
        throw new BadRequestException(
          'NEW_POSITION fields must be null for EXISTING_POSITION',
        );
      }
      const position = await this.integrity.requirePosition(
        companyId,
        dto.existingPositionId,
      );
      if (isReplacementMotive(dto.motive)) {
        if (!dto.replacedEmployeeId) {
          throw new BadRequestException(
            'replacedEmployeeId is required for replacement motives',
          );
        }
        await this.occupants.resolve(
          companyId,
          dto.existingPositionId,
          dto.replacedEmployeeId,
        );
      } else if (dto.replacedEmployeeId) {
        throw new BadRequestException(
          'replacedEmployeeId must be null for NEW_POSITION',
        );
      }

      const exceedsStructure = dto.requestedHeadcount > position.headcount;
      if (exceedsStructure && !dto.justification?.trim()) {
        throw new BadRequestException(
          'justification is required when requestedHeadcount exceeds position headcount',
        );
      }
      return;
    }

    if (dto.existingPositionId) {
      throw new BadRequestException(
        'existingPositionId must be null for NEW_POSITION',
      );
    }
    if (dto.replacedEmployeeId) {
      throw new BadRequestException(
        'replacedEmployeeId must be null for NEW_POSITION',
      );
    }
    if (!dto.requestedPositionName?.trim()) {
      throw new BadRequestException(
        'requestedPositionName is required for NEW_POSITION',
      );
    }
    if (!dto.requestedAreaId) {
      throw new BadRequestException(
        'requestedAreaId is required for NEW_POSITION',
      );
    }
    if (!dto.justification?.trim()) {
      throw new BadRequestException(
        'justification is required for NEW_POSITION',
      );
    }
    await this.integrity.requireArea(companyId, dto.requestedAreaId);
    if (dto.requestedJobLevelId) {
      await this.integrity.requireJobLevel(companyId, dto.requestedJobLevelId);
    }
  }

  private toCreateData(
    companyId: string,
    requestedByEmployeeId: string,
    dto: CreateVacancyRequestDto,
    resolved: { type: VacancyRequestType; motive: VacancyRequestMotive },
  ): Prisma.VacancyRequestCreateInput {
    const expectedHiringDate = parseDateOnlyUtc(dto.expectedHiringDate)!;
    const base = {
      company: { connect: { id: companyId } },
      requestedByEmployee: { connect: { id: requestedByEmployeeId } },
      type: resolved.type,
      motive: resolved.motive,
      requestedHeadcount: dto.requestedHeadcount,
      expectedHiringDate,
      justification: (dto.justification ?? '').trim(),
      generalManagerApprovalRequired:
        dto.generalManagerApprovalRequired ?? false,
      status: VacancyRequestStatus.DRAFT,
    };

    if (resolved.type === VacancyRequestType.EXISTING_POSITION) {
      return {
        ...base,
        existingPosition: { connect: { id: dto.existingPositionId! } },
        ...(dto.replacedEmployeeId
          ? { replacedEmployee: { connect: { id: dto.replacedEmployeeId } } }
          : {}),
      };
    }

    return {
      ...base,
      requestedPositionName: dto.requestedPositionName!.trim(),
      requestedArea: { connect: { id: dto.requestedAreaId! } },
      ...(dto.requestedJobLevelId
        ? { requestedJobLevel: { connect: { id: dto.requestedJobLevelId } } }
        : {}),
    };
  }

  private shapeFieldsForType(
    type: VacancyRequestType,
    shape: {
      existingPositionId?: string | null;
      requestedPositionName?: string | null;
      requestedAreaId?: string | null;
      requestedJobLevelId?: string | null;
    },
  ): Prisma.VacancyRequestUncheckedUpdateInput {
    if (type === VacancyRequestType.EXISTING_POSITION) {
      return {
        existingPositionId: shape.existingPositionId ?? null,
        requestedPositionName: null,
        requestedAreaId: null,
        requestedJobLevelId: null,
      };
    }
    return {
      existingPositionId: null,
      requestedPositionName: shape.requestedPositionName?.trim() ?? null,
      requestedAreaId: shape.requestedAreaId ?? null,
      requestedJobLevelId: shape.requestedJobLevelId ?? null,
    };
  }

  private async requireDraft(
    companyId: string,
    id: string,
  ): Promise<VacancyRequest> {
    const request = await this.prisma.vacancyRequest.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!request) {
      throw new NotFoundException('Vacancy request not found');
    }
    if (request.status !== VacancyRequestStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT vacancy requests can be edited',
      );
    }
    return request;
  }

  private async seedApprovalPlan(companyId: string, requestId: string) {
    const workflow = await this.prisma.vacancyApprovalWorkflow.findUnique({
      where: { companyId },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
    const defaults = workflow?.enabled ? workflow.steps : [];
    if (defaults.length > MAX_VACANCY_APPROVAL_STEPS) {
      throw new BadRequestException(
        `A workflow can have at most ${MAX_VACANCY_APPROVAL_STEPS} steps`,
      );
    }
    const rows: Prisma.VacancyRequestApprovalPlanStepCreateManyInput[] =
      defaults.map((step, index) => ({
        companyId,
        vacancyRequestId: requestId,
        sequence: index + 1,
        origin: VacancyApprovalPlanOrigin.DEFAULT,
        approverType: step.approverType,
        label: step.label,
        positionId: step.positionId,
        specificEmployeeId: step.specificEmployeeId,
        requiredRoleCode: step.requiredRoleCode,
        updatedAt: new Date(),
      }));
    if (rows.length > 0) {
      await this.prisma.vacancyRequestApprovalPlanStep.createMany({ data: rows });
    }
  }
}
