import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  InterviewFormStatus,
  InterviewStatus,
  InterviewType,
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
      ApplicationStage.INTERVIEW,
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
            birthDate: true,
            country: true,
            state: true,
            city: true,
            professionalProfile: true,
            linkedinUrl: true,
            status: true,
            cvFileName: true,
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
        workExperiences: { orderBy: { sortOrder: 'asc' } },
        educations: { orderBy: { sortOrder: 'asc' } },
        screeningAnswers: { orderBy: { sortOrder: 'asc' } },
        preHireDocuments: {
          select: {
            id: true,
            kind: true,
            originalName: true,
            mimeType: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { kind: 'asc' },
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

      if (dto.stage === ApplicationStage.INTERVIEW) {
        await this.ensurePendingInterview(
          tx,
          companyId,
          id,
          application.vacancyId,
          InterviewType.HR,
        );
      }
      if (dto.stage === ApplicationStage.OFFER) {
        await this.ensurePendingInterview(
          tx,
          companyId,
          id,
          application.vacancyId,
          InterviewType.TECHNICAL,
        );
      }

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
      select: {
        id: true,
        title: true,
        status: true,
        vacancyRequest: {
          select: {
            evaluators: {
              orderBy: { sequence: 'asc' },
              select: {
                employeeId: true,
                employee: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
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
            cvFileName: true,
          },
        },
        preHireDocuments: {
          select: { kind: true },
        },
        interviews: {
          where: {
            deletedAt: null,
            status: { not: InterviewStatus.CANCELLED },
          },
          select: {
            status: true,
            questions: {
              select: {
                answers: { select: { rating: true } },
              },
            },
            interviewers: {
              select: {
                employeeId: true,
                employee: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { lastStageChangedAt: 'desc' },
    });

    const configuredEvaluators =
      vacancy.vacancyRequest?.evaluators.map((item) => ({
        employeeId: item.employeeId,
        name: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
      })) ?? [];

    const byStage = new Map<ApplicationStage, typeof applications>();
    for (const stage of PIPELINE_STAGES) {
      byStage.set(stage, []);
    }
    for (const application of applications) {
      byStage.get(application.stage)?.push(application);
    }

    return {
      vacancy: {
        id: vacancy.id,
        title: vacancy.title,
        status: vacancy.status,
      },
      columns: PIPELINE_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return {
          stage,
          count: items.length,
          applications: items.map((item) => {
            const interviewFit = this.fitLevelFromInterviews(item.interviews);
            const profileFit = this.normalizeFitLevel(item.profileFitLevel);
            const fitLevel =
              interviewFit !== 'gray' ? interviewFit : profileFit;
            return {
              applicationId: item.id,
              candidateId: item.candidateId,
              candidateName: `${item.candidate.firstName} ${item.candidate.lastName}`,
              candidateEmail: item.candidate.email,
              hasCv: Boolean(item.candidate.cvFileName),
              hasSecurityStudyDoc: item.preHireDocuments.some(
                (doc) => doc.kind === 'SECURITY_STUDY',
              ),
              hasMedicalExamDoc: item.preHireDocuments.some(
                (doc) => doc.kind === 'MEDICAL_EXAM',
              ),
              securityStudyStatus: item.securityStudyStatus,
              medicalExamStatus: item.medicalExamStatus,
              stage: item.stage,
              lastStageChangedAt: item.lastStageChangedAt,
              fitLevel,
              fitSummary:
                interviewFit !== 'gray'
                  ? null
                  : (item.profileFitSummary ?? null),
              evaluatorStatuses: this.evaluatorStatusesForCard(
                configuredEvaluators,
                item.interviews,
              ),
            };
          }),
        };
      }),
    };
  }

  private async ensurePendingInterview(
    tx: Prisma.TransactionClient,
    companyId: string,
    applicationId: string,
    vacancyId: string,
    type: InterviewType,
  ) {
    const existingOpen = await tx.interview.findFirst({
      where: {
        companyId,
        applicationId,
        type,
        deletedAt: null,
        status: {
          in: [
            InterviewStatus.DRAFT,
            InterviewStatus.SCHEDULED,
            InterviewStatus.IN_PROGRESS,
          ],
        },
      },
      select: { id: true },
    });
    if (existingOpen) return;

    const interviewerEmployeeId = await this.resolveDefaultInterviewer(
      tx,
      companyId,
      vacancyId,
      type,
    );

    await this.createEvaluatorInterview(tx, {
      companyId,
      applicationId,
      vacancyId,
      type,
      interviewerEmployeeId,
    });
  }

  /**
   * Creates an evaluable interview for a given interviewer (defaults applied by caller).
   */
  async createEvaluatorInterview(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      applicationId: string;
      vacancyId: string;
      type: InterviewType;
      interviewerEmployeeId: string | null;
    },
  ) {
    const vacancy = await tx.vacancy.findFirst({
      where: { id: input.vacancyId, companyId: input.companyId },
      select: { interviewFormTemplateId: true },
    });

    let template = vacancy?.interviewFormTemplateId
      ? await tx.interviewFormTemplate.findFirst({
          where: {
            id: vacancy.interviewFormTemplateId,
            companyId: input.companyId,
            deletedAt: null,
            status: InterviewFormStatus.ACTIVE,
          },
          include: { questions: { orderBy: { order: 'asc' } } },
        })
      : null;

    if (!template) {
      template = await tx.interviewFormTemplate.findFirst({
        where: {
          companyId: input.companyId,
          type: input.type,
          deletedAt: null,
          status: InterviewFormStatus.ACTIVE,
        },
        include: { questions: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    }

    const now = new Date();
    return tx.interview.create({
      data: {
        companyId: input.companyId,
        applicationId: input.applicationId,
        type: input.type,
        status: InterviewStatus.IN_PROGRESS,
        scheduledAt: now,
        startedAt: now,
        ...(input.interviewerEmployeeId
          ? {
              interviewers: {
                create: [{ employeeId: input.interviewerEmployeeId }],
              },
            }
          : {}),
        ...(template
          ? {
              questions: {
                create: template.questions.map((question) => ({
                  companyId: input.companyId,
                  sourceTemplateQuestionId: question.id,
                  text: question.text,
                  type: question.type,
                  required: question.required,
                  weight: question.weight,
                  order: question.order,
                })),
              },
            }
          : {}),
      },
    });
  }

  private async resolveDefaultInterviewer(
    tx: Prisma.TransactionClient,
    companyId: string,
    vacancyId: string,
    type: InterviewType,
  ): Promise<string | null> {
    const vacancy = await tx.vacancy.findFirst({
      where: { id: vacancyId, companyId },
      select: {
        assignedRecruiterEmployeeId: true,
        vacancyRequest: {
          select: {
            evaluators: {
              orderBy: { sequence: 'asc' },
              select: { employeeId: true },
            },
          },
        },
      },
    });
    if (!vacancy) return null;

    if (type === InterviewType.HR) {
      const firstEvaluator = vacancy.vacancyRequest?.evaluators[0]?.employeeId;
      if (firstEvaluator) return firstEvaluator;
    }

    return vacancy.assignedRecruiterEmployeeId ?? null;
  }

  private fitLevelFromInterviews(
    interviews: Array<{
      questions: Array<{ answers: Array<{ rating: number | null }> }>;
    }>,
  ): 'green' | 'yellow' | 'red' | 'gray' {
    const ratings: number[] = [];
    for (const interview of interviews) {
      for (const question of interview.questions) {
        for (const answer of question.answers) {
          if (typeof answer.rating === 'number') ratings.push(answer.rating);
        }
      }
    }
    if (ratings.length === 0) return 'gray';
    const average =
      ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
    if (average >= 4) return 'green';
    if (average >= 3) return 'yellow';
    return 'red';
  }

  private normalizeFitLevel(
    value: string | null | undefined,
  ): 'green' | 'yellow' | 'red' | 'gray' {
    if (value === 'green' || value === 'yellow' || value === 'red')
      return value;
    return 'gray';
  }

  private evaluatorStatusesForCard(
    configured: Array<{ employeeId: string; name: string }>,
    interviews: Array<{
      status: InterviewStatus;
      interviewers: Array<{
        employeeId: string;
        employee: { id: string; firstName: string; lastName: string };
      }>;
    }>,
  ): Array<{
    employeeId: string | null;
    name: string;
    status: 'pending' | 'approved' | 'in_progress';
  }> {
    if (configured.length > 0) {
      return configured.map((evaluator) => {
        const related = interviews.filter((interview) =>
          interview.interviewers.some(
            (person) => person.employeeId === evaluator.employeeId,
          ),
        );
        return {
          employeeId: evaluator.employeeId,
          name: evaluator.name,
          status: this.evaluatorStatusFromInterviews(related),
        };
      });
    }

    const byEmployee = new Map<
      string,
      {
        employeeId: string;
        name: string;
        interviews: Array<{ status: InterviewStatus }>;
      }
    >();
    for (const interview of interviews) {
      for (const person of interview.interviewers) {
        const existing = byEmployee.get(person.employeeId);
        if (existing) {
          existing.interviews.push(interview);
          continue;
        }
        byEmployee.set(person.employeeId, {
          employeeId: person.employeeId,
          name: `${person.employee.firstName} ${person.employee.lastName}`.trim(),
          interviews: [interview],
        });
      }
    }
    return [...byEmployee.values()].map((item) => ({
      employeeId: item.employeeId,
      name: item.name,
      status: this.evaluatorStatusFromInterviews(item.interviews),
    }));
  }

  private evaluatorStatusFromInterviews(
    interviews: Array<{ status: InterviewStatus }>,
  ): 'pending' | 'approved' | 'in_progress' {
    if (interviews.length === 0) return 'pending';
    if (interviews.every((item) => item.status === InterviewStatus.COMPLETED)) {
      return 'approved';
    }
    if (
      interviews.some(
        (item) =>
          item.status === InterviewStatus.IN_PROGRESS ||
          item.status === InterviewStatus.COMPLETED ||
          item.status === InterviewStatus.SCHEDULED,
      )
    ) {
      return 'in_progress';
    }
    return 'pending';
  }
}
