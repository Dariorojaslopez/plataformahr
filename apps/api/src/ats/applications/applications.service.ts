import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  Prisma,
  VacancyStatus,
  type Application,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PIPELINE_STAGES,
} from '../ats.constants';
import type {
  CreateApplicationDto,
  ListApplicationsQueryDto,
  MoveApplicationDto,
} from './dto/application.dto';

const ALLOWED_STAGE_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> =
  {
    [ApplicationStage.PENDING_REVIEW]: [
      ApplicationStage.CONTACTED,
      ApplicationStage.REJECTED,
      ApplicationStage.WITHDRAWN,
    ],
    [ApplicationStage.CONTACTED]: [
      ApplicationStage.INTERVIEW,
      ApplicationStage.REJECTED,
      ApplicationStage.WITHDRAWN,
    ],
    [ApplicationStage.INTERVIEW]: [
      ApplicationStage.OFFER,
      ApplicationStage.REJECTED,
      ApplicationStage.WITHDRAWN,
    ],
    [ApplicationStage.OFFER]: [
      ApplicationStage.REJECTED,
      ApplicationStage.WITHDRAWN,
    ],
    [ApplicationStage.HIRED]: [],
    [ApplicationStage.REJECTED]: [],
    [ApplicationStage.WITHDRAWN]: [],
  };

const TERMINAL_STAGES = new Set<ApplicationStage>([
  ApplicationStage.HIRED,
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
]);

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListApplicationsQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.ApplicationWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.vacancyId ? { vacancyId: query.vacancyId } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.areaId || query.positionId
        ? {
            vacancy: {
              ...(query.areaId ? { areaId: query.areaId } : {}),
              ...(query.positionId ? { positionId: query.positionId } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            candidate: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                {
                  email: {
                    contains: search.toLowerCase(),
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
            },
          },
          vacancy: {
            select: {
              id: true,
              title: true,
              status: true,
              position: { select: { id: true, name: true } },
              area: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        vacancy: {
          select: {
            id: true,
            title: true,
            status: true,
            position: { select: { id: true, name: true } },
            area: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, companyId, deletedAt: null },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: dto.vacancyId, companyId, deletedAt: null },
    });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }
    if (vacancy.status !== VacancyStatus.OPEN) {
      throw new BadRequestException(
        `Cannot apply to vacancy with status ${vacancy.status}`,
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const application = await tx.application.create({
          data: {
            companyId,
            candidateId: candidate.id,
            vacancyId: vacancy.id,
            stage: ApplicationStage.PENDING_REVIEW,
            status: ApplicationStatus.ACTIVE,
            appliedAt: new Date(),
            lastStageChangedAt: new Date(),
          },
        });

        await tx.applicationStageHistory.create({
          data: {
            companyId,
            applicationId: application.id,
            fromStage: null,
            toStage: ApplicationStage.PENDING_REVIEW,
            changedByUserId: userId,
          },
        });

        return application;
      });

      await this.audit.create({
        action: ATS_AUDIT.APPLICATION_CREATED,
        entity: 'Application',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          applicationId: created.id,
          candidateId: candidate.id,
          vacancyId: vacancy.id,
          toStage: ApplicationStage.PENDING_REVIEW,
        },
      });

      return created;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Candidate already has an application for this vacancy',
        );
      }
      throw error;
    }
  }

  async move(
    companyId: string,
    userId: string,
    id: string,
    dto: MoveApplicationDto,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Row lock: concurrent moves serialize; loser sees the new stage.
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          companyId: string;
          candidateId: string;
          vacancyId: string;
          stage: ApplicationStage;
          status: ApplicationStatus;
        }>
      >`
        SELECT id, "companyId", "candidateId", "vacancyId", stage, status
        FROM applications
        WHERE id = ${id}::uuid
          AND "companyId" = ${companyId}::uuid
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;

      const application = locked[0];
      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (application.stage === dto.stage) {
        throw new ConflictException(
          'Application stage changed concurrently; retry with current stage',
        );
      }

      const allowed = ALLOWED_STAGE_TRANSITIONS[application.stage];
      if (dto.stage === ApplicationStage.HIRED) {
        throw new BadRequestException(
          'HIRED can only be set via formal Hiring (POST /ats/applications/:id/hire)',
        );
      }
      if (!allowed.includes(dto.stage)) {
        throw new BadRequestException(
          `Invalid stage transition: ${application.stage} -> ${dto.stage}`,
        );
      }

      const nextStatus = TERMINAL_STAGES.has(dto.stage)
        ? ApplicationStatus.CLOSED
        : ApplicationStatus.ACTIVE;

      const transition = await tx.application.updateMany({
        where: {
          id,
          companyId,
          stage: application.stage,
          deletedAt: null,
        },
        data: {
          stage: dto.stage,
          status: nextStatus,
          lastStageChangedAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException(
          'Application stage changed concurrently; retry with current stage',
        );
      }

      await tx.applicationStageHistory.create({
        data: {
          companyId,
          applicationId: id,
          fromStage: application.stage,
          toStage: dto.stage,
          changedByUserId: userId,
          comment: dto.comment?.trim() || null,
        },
      });

      const current = await tx.application.findFirstOrThrow({
        where: { id, companyId },
      });

      return {
        application: current,
        fromStage: application.stage,
        candidateId: application.candidateId,
        vacancyId: application.vacancyId,
      };
    });

    await this.audit.create({
      action: ATS_AUDIT.APPLICATION_STAGE_CHANGED,
      entity: 'Application',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        applicationId: id,
        candidateId: updated.candidateId,
        vacancyId: updated.vacancyId,
        fromStage: updated.fromStage,
        toStage: dto.stage,
      },
    });

    return updated.application;
  }

  async history(companyId: string, applicationId: string) {
    await this.getById(companyId, applicationId);
    return this.prisma.applicationStageHistory.findMany({
      where: { companyId, applicationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fromStage: true,
        toStage: true,
        changedByUserId: true,
        comment: true,
        createdAt: true,
      },
    });
  }

  async pipeline(companyId: string, vacancyId: string) {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, companyId, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }

    const applications = await this.prisma.application.findMany({
      where: {
        companyId,
        vacancyId,
        deletedAt: null,
      },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { lastStageChangedAt: 'desc' },
    });

    const byStage = new Map<ApplicationStage, typeof applications>();
    for (const stage of PIPELINE_STAGES) {
      byStage.set(stage, []);
    }
    for (const application of applications) {
      byStage.get(application.stage)?.push(application);
    }

    return {
      vacancy,
      columns: PIPELINE_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return {
          stage,
          count: items.length,
          applications: items.map((item) => ({
            applicationId: item.id,
            candidateId: item.candidateId,
            candidateName: `${item.candidate.firstName} ${item.candidate.lastName}`,
            candidateEmail: item.candidate.email,
            stage: item.stage,
            lastStageChangedAt: item.lastStageChangedAt,
          })),
        };
      }),
    };
  }
}
