import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  MembershipStatus,
  Prisma,
  VacancyStatus,
  type Vacancy,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import type { TenantContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../ats.constants';
import type {
  ListVacanciesQueryDto,
  UpdateVacancyDto,
} from './dto/vacancy.dto';

const ALLOWED_TRANSITIONS: Record<VacancyStatus, VacancyStatus[]> = {
  [VacancyStatus.OPEN]: [
    VacancyStatus.PAUSED,
    VacancyStatus.CLOSED,
    VacancyStatus.CANCELLED,
  ],
  [VacancyStatus.PAUSED]: [
    VacancyStatus.OPEN,
    VacancyStatus.CLOSED,
    VacancyStatus.CANCELLED,
  ],
  [VacancyStatus.CLOSED]: [],
  [VacancyStatus.CANCELLED]: [],
};

const ASSIGNABLE_RECRUITER_ROLES = new Set(['RECRUITER', 'CLIENT_ADMIN']);

const VACANCY_LIST_INCLUDE = {
  position: {
    select: {
      id: true,
      name: true,
      headcount: true,
      mission: true,
      responsibilities: true,
      requiredExperience: true,
    },
  },
  area: { select: { id: true, name: true } },
  assignedRecruiter: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class VacanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  async list(tenant: TenantContext, query: ListVacanciesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const assignedFilter = await this.assignedVacancyWhere(tenant);

    const where: Prisma.VacancyWhereInput = {
      companyId: tenant.companyId,
      deletedAt: null,
      ...assignedFilter,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            title: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vacancy.findMany({
        where,
        include: VACANCY_LIST_INCLUDE,
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vacancy.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listRecruiters(companyId: string) {
    const memberships = await this.prisma.companyMembership.findMany({
      where: {
        companyId,
        status: MembershipStatus.ACTIVE,
        roles: { some: { role: { code: 'RECRUITER' } } },
      },
      select: { userId: true },
    });
    const userIds = memberships.map((item) => item.userId);
    if (userIds.length === 0) return [];
    return this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
        userId: { in: userIds },
      },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getById(tenant: TenantContext, id: string) {
    const assignedFilter = await this.assignedVacancyWhere(tenant);
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id, companyId: tenant.companyId, deletedAt: null, ...assignedFilter },
      include: {
        position: true,
        area: true,
        assignedRecruiter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        vacancyRequest: {
          select: {
            id: true,
            type: true,
            status: true,
            requestedHeadcount: true,
          },
        },
      },
    });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }
    return this.serialize(vacancy);
  }

  async update(
    tenant: TenantContext,
    userId: string,
    id: string,
    dto: UpdateVacancyDto,
  ) {
    const existing = await this.requireVisibleVacancy(tenant, id);

    if (dto.status && dto.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid vacancy status transition: ${existing.status} -> ${dto.status}`,
        );
      }
    }

    const assignedRecruiterEmployeeId =
      dto.assignedRecruiterEmployeeId === undefined
        ? undefined
        : await this.resolveAssignedRecruiter(
            tenant.companyId,
            dto.assignedRecruiterEmployeeId,
          );

    const salaryAmount =
      dto.salaryAmount === undefined
        ? undefined
        : dto.salaryAmount === null || dto.salaryAmount === ''
          ? null
          : this.parseSalary(dto.salaryAmount);
    if (dto.salaryCurrency !== undefined) {
      this.assertCurrency(dto.salaryCurrency);
    }
    const nextShowSalaryPublic =
      dto.showSalaryPublic ?? existing.showSalaryPublic;
    const nextSalaryAmount =
      salaryAmount === undefined ? existing.salaryAmount : salaryAmount;
    if (nextShowSalaryPublic && nextSalaryAmount == null) {
      throw new BadRequestException(
        'salaryAmount is required to show salary on the public vacancy',
      );
    }

    const updated = await this.prisma.vacancy.update({
      where: { id },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(assignedRecruiterEmployeeId !== undefined
          ? { assignedRecruiterEmployeeId }
          : {}),
        ...(salaryAmount !== undefined ? { salaryAmount } : {}),
        ...(dto.salaryCurrency !== undefined
          ? { salaryCurrency: dto.salaryCurrency }
          : {}),
        ...(dto.showSalaryPublic !== undefined
          ? { showSalaryPublic: dto.showSalaryPublic }
          : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              closedAt:
                dto.status === VacancyStatus.CLOSED ||
                dto.status === VacancyStatus.CANCELLED
                  ? new Date()
                  : dto.status === VacancyStatus.OPEN ||
                      dto.status === VacancyStatus.PAUSED
                    ? null
                    : existing.closedAt,
            }
          : {}),
      },
      include: {
        assignedRecruiter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.audit.create({
        action: ATS_AUDIT.VACANCY_STATUS_CHANGED,
        entity: 'Vacancy',
        entityId: updated.id,
        company: { connect: { id: tenant.companyId } },
        user: { connect: { id: userId } },
        metadata: {
          id: updated.id,
          from: existing.status,
          to: updated.status,
        },
      });
    }

    if (
      assignedRecruiterEmployeeId !== undefined &&
      assignedRecruiterEmployeeId !== existing.assignedRecruiterEmployeeId
    ) {
      await this.audit.create({
        action: ATS_AUDIT.VACANCY_RECRUITER_ASSIGNED,
        entity: 'Vacancy',
        entityId: updated.id,
        company: { connect: { id: tenant.companyId } },
        user: { connect: { id: userId } },
        metadata: {
          id: updated.id,
          from: existing.assignedRecruiterEmployeeId,
          to: assignedRecruiterEmployeeId,
        },
      });
    }

    if (
      (salaryAmount !== undefined &&
        String(existing.salaryAmount ?? '') !== String(salaryAmount ?? '')) ||
      (dto.showSalaryPublic !== undefined &&
        dto.showSalaryPublic !== existing.showSalaryPublic) ||
      (dto.salaryCurrency !== undefined &&
        dto.salaryCurrency !== existing.salaryCurrency)
    ) {
      await this.audit.create({
        action: ATS_AUDIT.VACANCY_SALARY_UPDATED,
        entity: 'Vacancy',
        entityId: updated.id,
        company: { connect: { id: tenant.companyId } },
        user: { connect: { id: userId } },
        metadata: {
          id: updated.id,
          showSalaryPublic: updated.showSalaryPublic,
        },
      });
    }

    return this.serialize(updated);
  }

  async publish(
    tenant: TenantContext,
    userId: string,
    id: string,
  ): Promise<Vacancy> {
    const existing = await this.requireVisibleVacancy(tenant, id);
    if (existing.status !== VacancyStatus.OPEN) {
      throw new BadRequestException('Only OPEN vacancies can be published');
    }
    if (existing.publishedAt) {
      return existing;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const updated = await this.prisma.vacancy.update({
          where: { id },
          data: {
            publicId:
              existing.publicId ?? randomBytes(12).toString('base64url'),
            publishedAt: new Date(),
          },
        });
        await this.audit.create({
          action: ATS_AUDIT.VACANCY_PUBLISHED,
          entity: 'Vacancy',
          entityId: updated.id,
          company: { connect: { id: tenant.companyId } },
          user: { connect: { id: userId } },
          metadata: { vacancyId: updated.id, publicId: updated.publicId },
        });
        return updated;
      } catch (error: unknown) {
        const publicIdCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          !existing.publicId;
        if (!publicIdCollision) throw error;
      }
    }
    throw new ConflictException('Could not allocate a public vacancy URL');
  }

  async unpublish(
    tenant: TenantContext,
    userId: string,
    id: string,
  ): Promise<Vacancy> {
    const existing = await this.requireVisibleVacancy(tenant, id);
    if (!existing.publishedAt) {
      return existing;
    }

    const updated = await this.prisma.vacancy.update({
      where: { id },
      data: { publishedAt: null },
    });
    await this.audit.create({
      action: ATS_AUDIT.VACANCY_UNPUBLISHED,
      entity: 'Vacancy',
      entityId: updated.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: userId } },
      metadata: { vacancyId: updated.id, publicId: updated.publicId },
    });
    return updated;
  }

  async requireVisibleVacancy(tenant: TenantContext, id: string) {
    const assignedFilter = await this.assignedVacancyWhere(tenant);
    const existing = await this.prisma.vacancy.findFirst({
      where: {
        id,
        companyId: tenant.companyId,
        deletedAt: null,
        ...assignedFilter,
      },
    });
    if (!existing) {
      throw new NotFoundException('Vacancy not found');
    }
    return existing;
  }

  private async assignedVacancyWhere(
    tenant: TenantContext,
  ): Promise<Prisma.VacancyWhereInput> {
    if (tenant.viaPlatformOwner) return {};
    const roles = await this.rbac.getRoleCodesForMembership(tenant.membershipId);
    if (roles.has('CLIENT_ADMIN') || !roles.has('RECRUITER')) return {};
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId: tenant.companyId,
        userId: tenant.userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!employee) {
      return { id: '00000000-0000-0000-0000-000000000000' };
    }
    return { assignedRecruiterEmployeeId: employee.id };
  }

  private async resolveAssignedRecruiter(
    companyId: string,
    employeeId: string | null,
  ): Promise<string | null> {
    if (employeeId === null) return null;

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
        userId: { not: null },
      },
      select: { id: true, userId: true },
    });
    if (!employee?.userId) {
      throw new BadRequestException(
        'El colaborador no puede asignarse como reclutador.',
      );
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId,
        userId: employee.userId,
        status: MembershipStatus.ACTIVE,
      },
      include: { roles: { include: { role: { select: { code: true } } } } },
    });
    const codes = new Set(
      membership?.roles.map((item) => item.role.code) ?? [],
    );
    if (![...codes].some((code) => ASSIGNABLE_RECRUITER_ROLES.has(code))) {
      throw new BadRequestException(
        'El colaborador no es reclutador de esta compañía.',
      );
    }
    return employee.id;
  }

  private parseSalary(value: string): Prisma.Decimal {
    const decimal = new Prisma.Decimal(value);
    if (decimal.isNeg()) {
      throw new BadRequestException('salaryAmount must be >= 0');
    }
    return decimal;
  }

  private assertCurrency(code: string): void {
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new BadRequestException(
        'salaryCurrency must be a 3-letter ISO code',
      );
    }
  }

  private serialize<T extends { salaryAmount: Prisma.Decimal | null }>(
    vacancy: T,
  ) {
    return {
      ...vacancy,
      salaryAmount: vacancy.salaryAmount?.toFixed(2) ?? null,
    };
  }
}
