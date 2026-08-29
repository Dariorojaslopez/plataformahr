import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ApprovalStatus,
  MembershipStatus,
  Prisma,
  ReportingLineType,
  RoleScope,
  VacancyApprovalStep,
  VacancyApproverType,
} from '@prisma/client';
import type { TenantContext } from '../../auth/auth.types';
import { AuditService } from '../../core/audit/audit.service';
import { OrganizationIntegrityService } from '../../organization/organization-integrity.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  MAX_VACANCY_APPROVAL_STEPS,
  TEMP_APPROVER_ROLE_CODE,
  VACANCY_APPROVAL_ERRORS,
} from '../ats.constants';
import type {
  UpdateVacancyApprovalWorkflowDto,
  VacancyApprovalWorkflowStepInputDto,
} from './dto/vacancy-approval-workflow.dto';
import { snapshotStepFromApproverType } from './vacancy-approval.helpers';
import { PositionOccupantsService } from '../position-occupants/position-occupants.service';

type ResolvableStep = {
  sequence: number;
  approverType: VacancyApproverType;
  label: string | null;
  positionId: string | null;
  specificEmployeeId: string | null;
  requiredRoleCode: string | null;
};

const STEP_INCLUDE = {
  specificEmployee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  position: {
    select: { id: true, name: true },
  },
} as const;

@Injectable()
export class VacancyApprovalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
    private readonly occupants: PositionOccupantsService,
  ) {}

  async get(companyId: string) {
    const [workflow, allowedRoles] = await Promise.all([
      this.prisma.vacancyApprovalWorkflow.findUnique({
        where: { companyId },
        include: {
          steps: { orderBy: { sequence: 'asc' }, include: STEP_INCLUDE },
        },
      }),
      this.listCompanyRoles(),
    ]);

    return {
      enabled: workflow?.enabled ?? false,
      steps: workflow?.steps ?? [],
      allowedRoles,
    };
  }

  async update(tenant: TenantContext, dto: UpdateVacancyApprovalWorkflowDto) {
    if (dto.steps.length > MAX_VACANCY_APPROVAL_STEPS) {
      throw new BadRequestException(
        `A workflow can have at most ${MAX_VACANCY_APPROVAL_STEPS} steps`,
      );
    }
    if (dto.enabled && dto.steps.length === 0) {
      throw new BadRequestException(
        VACANCY_APPROVAL_ERRORS.ENABLED_WITHOUT_STEPS,
      );
    }

    const normalized = await this.normalizeSteps(tenant.companyId, dto.steps);

    const result = await this.prisma.$transaction(async (tx) => {
      const workflow = await tx.vacancyApprovalWorkflow.upsert({
        where: { companyId: tenant.companyId },
        create: {
          companyId: tenant.companyId,
          enabled: dto.enabled,
        },
        update: { enabled: dto.enabled },
      });

      await tx.vacancyApprovalWorkflowStep.deleteMany({
        where: { workflowId: workflow.id, companyId: tenant.companyId },
      });

      if (normalized.length > 0) {
        await tx.vacancyApprovalWorkflowStep.createMany({
          data: normalized.map((step, index) => ({
            companyId: tenant.companyId,
            workflowId: workflow.id,
            sequence: index + 1,
            approverType: step.approverType,
            label: step.label,
            positionId: step.positionId,
            specificEmployeeId: step.specificEmployeeId,
            requiredRoleCode: step.requiredRoleCode,
            updatedAt: new Date(),
          })),
        });
      }

      return tx.vacancyApprovalWorkflow.findUniqueOrThrow({
        where: { id: workflow.id },
        include: {
          steps: { orderBy: { sequence: 'asc' }, include: STEP_INCLUDE },
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_APPROVAL_WORKFLOW_UPDATED,
      entity: 'VacancyApprovalWorkflow',
      entityId: result.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: {
        id: result.id,
        enabled: result.enabled,
        stepCount: result.steps.length,
        approverTypes: result.steps.map((step) => step.approverType),
      },
    });

    return {
      enabled: result.enabled,
      steps: result.steps,
      allowedRoles: await this.listCompanyRoles(),
    };
  }

  async buildSnapshot(params: {
    companyId: string;
    vacancyRequestId: string;
    requestedByEmployeeId: string;
    generalManagerApprovalRequired: boolean;
  }): Promise<Prisma.VacancyApprovalCreateManyInput[]> {
    const workflow = await this.prisma.vacancyApprovalWorkflow.findUnique({
      where: { companyId: params.companyId },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });

    if (!workflow?.enabled) {
      return this.buildLegacySnapshot(params);
    }
    if (workflow.steps.length === 0) {
      throw new BadRequestException(VACANCY_APPROVAL_ERRORS.EMPTY_WORKFLOW);
    }

    const rows: Prisma.VacancyApprovalCreateManyInput[] = [];
    for (const step of workflow.steps) {
      rows.push(await this.resolveConfiguredStep(params, step));
    }
    return rows;
  }

  private async buildLegacySnapshot(params: {
    companyId: string;
    vacancyRequestId: string;
    requestedByEmployeeId: string;
    generalManagerApprovalRequired: boolean;
  }): Promise<Prisma.VacancyApprovalCreateManyInput[]> {
    const manager = await this.requireDirectManagerWithUser(
      params.companyId,
      params.requestedByEmployeeId,
    );

    const rows: Prisma.VacancyApprovalCreateManyInput[] = [
      {
        companyId: params.companyId,
        vacancyRequestId: params.vacancyRequestId,
        step: snapshotStepFromApproverType(
          VacancyApproverType.MANAGER_OF_REQUESTER,
        ),
        sequence: 1,
        label: null,
        approverEmployeeId: manager.id,
        status: ApprovalStatus.PENDING,
      },
      {
        companyId: params.companyId,
        vacancyRequestId: params.vacancyRequestId,
        step: VacancyApprovalStep.HR,
        sequence: 2,
        label: null,
        requiredRoleCode: TEMP_APPROVER_ROLE_CODE,
        status: ApprovalStatus.PENDING,
      },
    ];

    if (params.generalManagerApprovalRequired) {
      rows.push({
        companyId: params.companyId,
        vacancyRequestId: params.vacancyRequestId,
        step: VacancyApprovalStep.GENERAL_MANAGER,
        sequence: 3,
        label: null,
        requiredRoleCode: TEMP_APPROVER_ROLE_CODE,
        status: ApprovalStatus.PENDING,
      });
    }

    return rows;
  }

  async snapshotFromSteps(
    params: {
      companyId: string;
      vacancyRequestId: string;
      requestedByEmployeeId: string;
    },
    steps: ResolvableStep[],
  ) {
    if (steps.length === 0) {
      throw new BadRequestException(VACANCY_APPROVAL_ERRORS.EMPTY_WORKFLOW);
    }
    const rows: Prisma.VacancyApprovalCreateManyInput[] = [];
    for (const step of steps) {
      rows.push(await this.resolveConfiguredStep(params, step));
    }
    return rows;
  }

  private async resolveConfiguredStep(
    params: {
      companyId: string;
      vacancyRequestId: string;
      requestedByEmployeeId: string;
    },
    step: ResolvableStep,
  ): Promise<Prisma.VacancyApprovalCreateManyInput> {
    const base = {
      companyId: params.companyId,
      vacancyRequestId: params.vacancyRequestId,
      step: snapshotStepFromApproverType(step.approverType),
      sequence: step.sequence,
      label: step.label,
      positionId: step.positionId,
      status: ApprovalStatus.PENDING,
    };

    if (step.approverType === VacancyApproverType.MANAGER_OF_REQUESTER) {
      const manager = await this.requireDirectManagerWithUser(
        params.companyId,
        params.requestedByEmployeeId,
      );
      return { ...base, approverEmployeeId: manager.id };
    }

    if (step.approverType === VacancyApproverType.SPECIFIC_EMPLOYEE) {
      if (!step.specificEmployeeId) {
        throw new BadRequestException(
          VACANCY_APPROVAL_ERRORS.INVALID_EMPLOYEE_FIELDS,
        );
      }
      const employee = await this.requireApproverEmployee(
        params.companyId,
        step.specificEmployeeId,
        VACANCY_APPROVAL_ERRORS.SPECIFIC_EMPLOYEE_NO_USER,
      );
      return { ...base, approverEmployeeId: employee.id };
    }

    if (step.approverType === VacancyApproverType.POSITION) {
      const occupant = await this.occupants.resolve(
        params.companyId,
        step.positionId,
        step.specificEmployeeId,
      );
      return {
        ...base,
        positionId: step.positionId,
        approverEmployeeId: occupant.id,
      };
    }

    if (!step.requiredRoleCode) {
      throw new BadRequestException(
        VACANCY_APPROVAL_ERRORS.INVALID_ROLE_FIELDS,
      );
    }
    await this.requireCompanyRole(step.requiredRoleCode);
    return { ...base, requiredRoleCode: step.requiredRoleCode };
  }

  private async normalizeSteps(
    companyId: string,
    steps: VacancyApprovalWorkflowStepInputDto[],
  ) {
    const normalized: Array<{
      approverType: VacancyApproverType;
      label: string | null;
      positionId: string | null;
      specificEmployeeId: string | null;
      requiredRoleCode: string | null;
    }> = [];

    for (const step of steps) {
      const label = step.label?.trim() ? step.label.trim() : null;
      if (step.approverType === VacancyApproverType.MANAGER_OF_REQUESTER) {
        if (step.specificEmployeeId || step.requiredRoleCode || step.positionId) {
          throw new BadRequestException(
            VACANCY_APPROVAL_ERRORS.INVALID_MANAGER_FIELDS,
          );
        }
        normalized.push({
          approverType: step.approverType,
          label,
          positionId: null,
          specificEmployeeId: null,
          requiredRoleCode: null,
        });
        continue;
      }

      if (step.approverType === VacancyApproverType.SPECIFIC_EMPLOYEE) {
        if (!step.specificEmployeeId || step.requiredRoleCode) {
          throw new BadRequestException(
            VACANCY_APPROVAL_ERRORS.INVALID_EMPLOYEE_FIELDS,
          );
        }
        await this.requireApproverEmployee(
          companyId,
          step.specificEmployeeId,
          VACANCY_APPROVAL_ERRORS.SPECIFIC_EMPLOYEE_NO_USER,
        );
        normalized.push({
          approverType: step.approverType,
          label,
          positionId: step.positionId ?? null,
          specificEmployeeId: step.specificEmployeeId,
          requiredRoleCode: null,
        });
        continue;
      }

      if (step.approverType === VacancyApproverType.POSITION) {
        if (!step.positionId || step.requiredRoleCode) {
          throw new BadRequestException(
            VACANCY_APPROVAL_ERRORS.INVALID_POSITION_FIELDS,
          );
        }
        const occupant = await this.occupants.resolve(
          companyId,
          step.positionId,
          step.specificEmployeeId,
        );
        normalized.push({
          approverType: step.approverType,
          label,
          positionId: step.positionId,
          specificEmployeeId: occupant.id,
          requiredRoleCode: null,
        });
        continue;
      }

      if (!step.requiredRoleCode?.trim() || step.specificEmployeeId || step.positionId) {
        throw new BadRequestException(
          VACANCY_APPROVAL_ERRORS.INVALID_ROLE_FIELDS,
        );
      }
      await this.requireCompanyRole(step.requiredRoleCode.trim());
      normalized.push({
        approverType: step.approverType,
        label,
        positionId: null,
        specificEmployeeId: null,
        requiredRoleCode: step.requiredRoleCode.trim(),
      });
    }

    return normalized;
  }

  private async requireDirectManagerWithUser(
    companyId: string,
    requestedByEmployeeId: string,
  ) {
    const line = await this.prisma.employeeReportingLine.findFirst({
      where: {
        companyId,
        employeeId: requestedByEmployeeId,
        type: ReportingLineType.DIRECT,
      },
    });
    if (!line) {
      throw new BadRequestException(VACANCY_APPROVAL_ERRORS.NO_DIRECT_MANAGER);
    }
    return this.requireApproverEmployee(
      companyId,
      line.managerEmployeeId,
      VACANCY_APPROVAL_ERRORS.MANAGER_NO_USER,
    );
  }

  private async requireApproverEmployee(
    companyId: string,
    employeeId: string,
    missingUserMessage: string,
  ) {
    const employee = await this.integrity.requireEmployee(
      companyId,
      employeeId,
    );
    if (!employee.userId) {
      throw new BadRequestException(missingUserMessage);
    }
    const membership = await this.prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: employee.userId, companyId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException(missingUserMessage);
    }
    return employee;
  }

  private async requireCompanyRole(code: string) {
    const role = await this.prisma.role.findUnique({
      where: { scope_code: { scope: RoleScope.COMPANY, code } },
    });
    if (!role) {
      throw new BadRequestException(VACANCY_APPROVAL_ERRORS.UNKNOWN_ROLE);
    }
    return role;
  }

  private async listCompanyRoles() {
    return this.prisma.role.findMany({
      where: { scope: RoleScope.COMPANY },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    });
  }
}
