import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  CandidateStatus,
  EmployeeStatus,
  InterviewStatus,
  Prisma,
  VacancyRequestStatus,
  VacancyStatus,
} from '@prisma/client';
import type { TenantContext } from '../auth/auth.types';
import { AuditService } from '../core/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../core/rbac/rbac.service';
import { ATS_AUDIT } from '../ats/ats.constants';
import { ORG_AUDIT } from '../organization/organization.constants';
import {
  canDecideStep,
  currentPendingStep,
  type ApprovalActor,
} from '../ats/vacancy-requests/vacancy-approval.helpers';
import {
  emptyToNull,
  normalizeEmail,
} from '../organization/organization.helpers';
import type {
  CollaboratorHomeFeed,
  HomeAssignedMetrics,
  HomeAssignedVacancy,
  HomeOpenVacancy,
  HomePendingApproval,
  HomePendingEvaluation,
  HomeProfile,
  InternalJobApplicationDto,
  UpdateHomeProfileDto,
} from './dto/home.dto';
import { EMPTY_ASSIGNED_METRICS } from './dto/home.dto';

const PENDING_EVALUATION_STATUSES: InterviewStatus[] = [
  InterviewStatus.DRAFT,
  InterviewStatus.SCHEDULED,
  InterviewStatus.IN_PROGRESS,
];

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async getFeed(tenant: TenantContext): Promise<CollaboratorHomeFeed> {
    const employee = await this.findLinkedEmployee(tenant);
    const actor = await this.resolveActor(tenant, employee?.id ?? null);

    const [openVacancies, pendingApprovals, pendingEvaluations, assigned] =
      await Promise.all([
        this.listOpenVacancies(tenant.companyId),
        this.listPendingApprovals(tenant.companyId, actor),
        employee
          ? this.listPendingEvaluations(tenant.companyId, employee.id)
          : Promise.resolve([]),
        employee
          ? this.listAssignedWork(tenant.companyId, employee.id)
          : Promise.resolve({
              assignedVacancies: [] as HomeAssignedVacancy[],
              assignedMetrics: EMPTY_ASSIGNED_METRICS,
            }),
      ]);

    return {
      profile: employee ? this.toProfile(employee) : null,
      openVacancies,
      pendingApprovals,
      pendingEvaluations,
      assignedVacancies: assigned.assignedVacancies,
      assignedMetrics: assigned.assignedMetrics,
    };
  }

  async updateProfile(
    tenant: TenantContext,
    dto: UpdateHomeProfileDto,
  ): Promise<HomeProfile> {
    const employee = await this.findLinkedEmployee(tenant);
    if (!employee) {
      throw new NotFoundException(
        'No hay un colaborador vinculado a tu usuario.',
      );
    }

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(dto.email !== undefined
          ? { email: normalizeEmail(dto.email) }
          : {}),
        ...(dto.phone !== undefined ? { phone: emptyToNull(dto.phone) } : {}),
        ...(dto.country !== undefined
          ? { country: emptyToNull(dto.country) }
          : {}),
        ...(dto.state !== undefined ? { state: emptyToNull(dto.state) } : {}),
        ...(dto.city !== undefined ? { city: emptyToNull(dto.city) } : {}),
        ...(dto.maritalStatus !== undefined
          ? { maritalStatus: emptyToNull(dto.maritalStatus) }
          : {}),
        ...(dto.childrenCount !== undefined
          ? { childrenCount: dto.childrenCount }
          : {}),
        ...(dto.housingType !== undefined
          ? { housingType: emptyToNull(dto.housingType) }
          : {}),
        ...(dto.emergencyContactName !== undefined
          ? { emergencyContactName: emptyToNull(dto.emergencyContactName) }
          : {}),
        ...(dto.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: emptyToNull(dto.emergencyContactPhone) }
          : {}),
      },
      include: PROFILE_INCLUDE,
    });

    await this.audit.create({
      action: ORG_AUDIT.EMPLOYEE_UPDATED,
      entity: 'Employee',
      entityId: employee.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { id: employee.id, source: 'HOME_PROFILE' },
    });

    return this.toProfile(updated);
  }

  async applyToVacancy(
    tenant: TenantContext,
    vacancyId: string,
    dto: InternalJobApplicationDto,
  ): Promise<{ ok: true }> {
    const employee = await this.findLinkedEmployee(tenant);
    if (!employee) {
      throw new NotFoundException(
        'No hay un colaborador vinculado a tu usuario.',
      );
    }

    const phone = (dto.phone ?? employee.phone ?? '').trim();
    const documentType = (
      dto.documentType ??
      employee.documentType ??
      ''
    ).trim();
    const documentNumber = (
      dto.documentNumber ??
      employee.documentNumber ??
      ''
    ).trim();
    if (phone.length < 5) {
      throw new BadRequestException(
        'El teléfono es obligatorio para postularte.',
      );
    }
    if (!documentType || documentNumber.length < 3) {
      throw new BadRequestException(
        'La identificación es obligatoria para postularte.',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const vacancy = await tx.vacancy.findFirst({
          where: {
            id: vacancyId,
            companyId: tenant.companyId,
            status: VacancyStatus.OPEN,
            deletedAt: null,
          },
          select: { id: true, companyId: true },
        });
        if (!vacancy) {
          throw new NotFoundException('Vacante no disponible');
        }

        const email = employee.email.trim().toLowerCase();
        const [byEmail, byDocument] = await Promise.all([
          tx.candidate.findUnique({
            where: {
              companyId_email: { companyId: vacancy.companyId, email },
            },
          }),
          tx.candidate.findUnique({
            where: {
              companyId_documentNumber: {
                companyId: vacancy.companyId,
                documentNumber,
              },
            },
          }),
        ]);

        if (
          (byDocument && byDocument.id !== byEmail?.id) ||
          (byEmail?.documentNumber && byEmail.documentNumber !== documentNumber)
        ) {
          throw new ConflictException(
            'No fue posible registrar la postulación con estos datos.',
          );
        }

        const candidate = byEmail
          ? await tx.candidate.update({
              where: { id: byEmail.id },
              data: {
                deletedAt: null,
                status: CandidateStatus.ACTIVE,
                phone: byEmail.phone ?? phone,
                documentType: byEmail.documentType ?? documentType,
                documentNumber: byEmail.documentNumber ?? documentNumber,
              },
            })
          : await tx.candidate.create({
              data: {
                companyId: vacancy.companyId,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email,
                phone,
                documentType,
                documentNumber,
                source: 'INTERNAL_HOME',
                status: CandidateStatus.ACTIVE,
              },
            });

        const duplicate = await tx.application.findUnique({
          where: {
            candidateId_vacancyId: {
              candidateId: candidate.id,
              vacancyId: vacancy.id,
            },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ConflictException(
            'Ya existe una postulación para esta vacante.',
          );
        }

        const application = await tx.application.create({
          data: {
            companyId: vacancy.companyId,
            candidateId: candidate.id,
            vacancyId: vacancy.id,
            stage: ApplicationStage.PENDING_REVIEW,
            status: ApplicationStatus.ACTIVE,
            history: {
              create: {
                companyId: vacancy.companyId,
                toStage: ApplicationStage.PENDING_REVIEW,
              },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            action: ATS_AUDIT.APPLICATION_CREATED,
            entity: 'Application',
            entityId: application.id,
            companyId: vacancy.companyId,
            metadata: {
              applicationId: application.id,
              vacancyId: vacancy.id,
              source: 'INTERNAL_HOME',
              employeeId: employee.id,
            },
          },
        });
      });
      return { ok: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una postulación para esta vacante.',
        );
      }
      throw error;
    }
  }

  private async listOpenVacancies(
    companyId: string,
  ): Promise<HomeOpenVacancy[]> {
    const rows = await this.prisma.vacancy.findMany({
      where: {
        companyId,
        status: VacancyStatus.OPEN,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        publishedAt: true,
        area: { select: { name: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      areaName: row.area.name,
      published: row.publishedAt != null,
    }));
  }

  private async listPendingApprovals(
    companyId: string,
    actor: ApprovalActor,
  ): Promise<HomePendingApproval[]> {
    const pending = await this.prisma.vacancyRequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: VacancyRequestStatus.PENDING_APPROVAL,
      },
      include: {
        existingPosition: { select: { name: true } },
        requestedByEmployee: {
          select: { firstName: true, lastName: true },
        },
        approvals: {
          select: {
            step: true,
            sequence: true,
            status: true,
            approverEmployeeId: true,
            requiredRoleCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return pending
      .filter((item) => {
        const current = currentPendingStep(item.approvals);
        return current !== null && canDecideStep(current, actor);
      })
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        title:
          item.requestedPositionName ??
          item.existingPosition?.name ??
          'Solicitud de vacante',
        requesterName:
          `${item.requestedByEmployee.firstName} ${item.requestedByEmployee.lastName}`.trim(),
      }));
  }

  private async listPendingEvaluations(
    companyId: string,
    employeeId: string,
  ): Promise<HomePendingEvaluation[]> {
    const rows = await this.prisma.interview.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: PENDING_EVALUATION_STATUSES },
        interviewers: { some: { employeeId } },
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        application: {
          select: {
            candidate: { select: { firstName: true, lastName: true } },
            vacancy: { select: { title: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      candidateName:
        `${row.application.candidate.firstName} ${row.application.candidate.lastName}`.trim(),
      vacancyTitle: row.application.vacancy.title,
    }));
  }

  private async listAssignedWork(
    companyId: string,
    employeeId: string,
  ): Promise<{
    assignedVacancies: HomeAssignedVacancy[];
    assignedMetrics: HomeAssignedMetrics;
  }> {
    const rows = await this.prisma.vacancy.findMany({
      where: {
        companyId,
        assignedRecruiterEmployeeId: employeeId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        headcount: true,
        filledCount: true,
        area: { select: { name: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    });

    if (rows.length === 0) {
      return {
        assignedVacancies: [],
        assignedMetrics: EMPTY_ASSIGNED_METRICS,
      };
    }

    const vacancyIds = rows.map((row) => row.id);
    const [
      applicationCounts,
      activeApplicationCount,
      hiredCount,
      pendingInterviewCount,
    ] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['vacancyId'],
        where: {
          vacancyId: { in: vacancyIds },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      this.prisma.application.count({
        where: {
          vacancyId: { in: vacancyIds },
          deletedAt: null,
          status: ApplicationStatus.ACTIVE,
        },
      }),
      this.prisma.application.count({
        where: {
          vacancyId: { in: vacancyIds },
          deletedAt: null,
          stage: ApplicationStage.HIRED,
        },
      }),
      this.prisma.interview.count({
        where: {
          companyId,
          deletedAt: null,
          status: { in: PENDING_EVALUATION_STATUSES },
          application: {
            vacancyId: { in: vacancyIds },
            deletedAt: null,
          },
        },
      }),
    ]);

    const countByVacancy = new Map(
      applicationCounts.map((item) => [item.vacancyId, item._count._all]),
    );
    const assignedVacancies = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      areaName: row.area.name,
      headcount: row.headcount,
      filledCount: row.filledCount,
      applicationCount: countByVacancy.get(row.id) ?? 0,
    }));

    const assignedMetrics: HomeAssignedMetrics = {
      vacancyCount: assignedVacancies.length,
      openCount: assignedVacancies.filter(
        (item) => item.status === VacancyStatus.OPEN,
      ).length,
      applicationCount: assignedVacancies.reduce(
        (sum, item) => sum + item.applicationCount,
        0,
      ),
      activeApplicationCount,
      hiredCount,
      pendingInterviewCount,
      filledHeadcount: assignedVacancies.reduce(
        (sum, item) => sum + item.filledCount,
        0,
      ),
      requestedHeadcount: assignedVacancies.reduce(
        (sum, item) => sum + item.headcount,
        0,
      ),
    };

    return { assignedVacancies, assignedMetrics };
  }

  private async findLinkedEmployee(tenant: TenantContext) {
    return this.prisma.employee.findFirst({
      where: {
        companyId: tenant.companyId,
        userId: tenant.userId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      include: PROFILE_INCLUDE,
    });
  }

  private async resolveActor(
    tenant: TenantContext,
    employeeId: string | null,
  ): Promise<ApprovalActor> {
    const roleCodes = await this.rbac.getRoleCodesForMembership(
      tenant.membershipId,
    );
    return { roleCodes, userEmployeeId: employeeId };
  }

  private toProfile(
    employee: NonNullable<
      Awaited<ReturnType<HomeService['findLinkedEmployee']>>
    >,
  ): HomeProfile {
    return {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      documentType: employee.documentType,
      documentNumber: employee.documentNumber,
      birthDate: employee.birthDate
        ? employee.birthDate.toISOString().slice(0, 10)
        : null,
      country: employee.country,
      state: employee.state,
      city: employee.city,
      maritalStatus: employee.maritalStatus,
      childrenCount: employee.childrenCount,
      housingType: employee.housingType,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      areaName: employee.area.name,
      positionName: employee.position.name,
    };
  }
}

const PROFILE_INCLUDE = {
  area: { select: { name: true } },
  position: { select: { name: true } },
} as const;
