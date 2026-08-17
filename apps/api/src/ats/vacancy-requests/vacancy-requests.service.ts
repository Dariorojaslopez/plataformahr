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
  VacancyApprovalStep,
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
  MAX_LIMIT,
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

const APPROVAL_INCLUDE = {
  orderBy: { sequence: 'asc' as const },
  include: {
    approverEmployee: {
      select: { id: true, firstName: true, lastName: true, email: true },
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
          existingPosition: { select: { id: true, name: true } },
          requestedArea: { select: { id: true, name: true } },
          requestedByEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvals: APPROVAL_INCLUDE,
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
          existingPosition: { select: { id: true, name: true } },
          requestedArea: { select: { id: true, name: true } },
          requestedByEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvals: APPROVAL_INCLUDE,
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
        approvals: APPROVAL_INCLUDE,
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
    await this.validateRequestShape(tenant.companyId, dto);

    const created = await this.prisma.vacancyRequest.create({
      data: this.toCreateData(tenant.companyId, requestedByEmployeeId, dto),
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_REQUEST_CREATED,
      entity: 'VacancyRequest',
      entityId: created.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { id: created.id, status: created.status, type: created.type },
    });

    return created;
  }

  async update(
    tenant: TenantContext,
    id: string,
    dto: UpdateVacancyRequestDto,
  ): Promise<VacancyRequest> {
    const existing = await this.requireDraft(tenant.companyId, id);

    const mergedType = dto.type ?? existing.type;
    const shape = {
      type: mergedType,
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
      requestedHeadcount: dto.requestedHeadcount ?? existing.requestedHeadcount,
      justification: dto.justification ?? existing.justification,
      generalManagerApprovalRequired:
        dto.generalManagerApprovalRequired ??
        existing.generalManagerApprovalRequired,
    };

    if (dto.requestedByEmployeeId) {
      await this.resolveRequesterEmployeeId(tenant, dto.requestedByEmployeeId);
    }
    await this.validateRequestShape(tenant.companyId, shape);

    const updated = await this.prisma.vacancyRequest.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.requestedByEmployeeId !== undefined
          ? { requestedByEmployeeId: dto.requestedByEmployeeId }
          : {}),
        ...(dto.requestedHeadcount !== undefined
          ? { requestedHeadcount: dto.requestedHeadcount }
          : {}),
        ...(dto.justification !== undefined
          ? { justification: dto.justification.trim() }
          : {}),
        ...(dto.generalManagerApprovalRequired !== undefined
          ? {
              generalManagerApprovalRequired:
                dto.generalManagerApprovalRequired,
            }
          : {}),
        ...this.shapeFieldsForType(mergedType, shape),
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
      existingPositionId: request.existingPositionId,
      requestedPositionName: request.requestedPositionName,
      requestedAreaId: request.requestedAreaId,
      requestedJobLevelId: request.requestedJobLevelId,
      requestedHeadcount: request.requestedHeadcount,
      justification: request.justification,
      generalManagerApprovalRequired: request.generalManagerApprovalRequired,
    });

    const approvalsData = await this.workflow.buildSnapshot({
      companyId: tenant.companyId,
      vacancyRequestId: id,
      requestedByEmployeeId: request.requestedByEmployeeId,
      generalManagerApprovalRequired: request.generalManagerApprovalRequired,
    });

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

      return tx.vacancyRequest.findFirstOrThrow({
        where: { id, companyId: tenant.companyId },
        include: { approvals: APPROVAL_INCLUDE },
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
          include: { approvals: APPROVAL_INCLUDE },
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

      await tx.position.update({
        where: { id: position.id },
        data: {
          headcount: { increment: request.requestedHeadcount },
        },
      });

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

  private async validateRequestShape(
    companyId: string,
    dto: {
      type: VacancyRequestType;
      existingPositionId?: string | null;
      requestedPositionName?: string | null;
      requestedAreaId?: string | null;
      requestedJobLevelId?: string | null;
      requestedHeadcount: number;
      justification: string;
      generalManagerApprovalRequired?: boolean;
    },
  ): Promise<void> {
    if (dto.requestedHeadcount < 1) {
      throw new BadRequestException('requestedHeadcount must be >= 1');
    }
    if (!dto.justification?.trim()) {
      throw new BadRequestException('justification is required');
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
      await this.integrity.requirePosition(companyId, dto.existingPositionId);
      return;
    }

    if (dto.existingPositionId) {
      throw new BadRequestException(
        'existingPositionId must be null for NEW_POSITION',
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
    await this.integrity.requireArea(companyId, dto.requestedAreaId);
    if (dto.requestedJobLevelId) {
      await this.integrity.requireJobLevel(companyId, dto.requestedJobLevelId);
    }
  }

  private toCreateData(
    companyId: string,
    requestedByEmployeeId: string,
    dto: CreateVacancyRequestDto,
  ): Prisma.VacancyRequestCreateInput {
    const base = {
      company: { connect: { id: companyId } },
      requestedByEmployee: { connect: { id: requestedByEmployeeId } },
      type: dto.type,
      requestedHeadcount: dto.requestedHeadcount,
      justification: dto.justification.trim(),
      generalManagerApprovalRequired:
        dto.generalManagerApprovalRequired ?? false,
      status: VacancyRequestStatus.DRAFT,
    };

    if (dto.type === VacancyRequestType.EXISTING_POSITION) {
      return {
        ...base,
        existingPosition: { connect: { id: dto.existingPositionId! } },
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
}
