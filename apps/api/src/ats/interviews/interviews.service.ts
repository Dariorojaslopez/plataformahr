import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  EmployeeStatus,
  InterviewFormStatus,
  InterviewQuestionType,
  InterviewStatus,
  Prisma,
  TranscriptSegmentKind,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ATS_AUDIT, TEMP_APPROVER_ROLE_CODE } from '../ats.constants';
import type {
  AddTemplateQuestionDto,
  ApplyProcessInterviewTemplateDto,
  CreateInterviewDto,
  CreateInterviewFormTemplateDto,
  CreateTranscriptSegmentDto,
  UpdateInterviewDto,
  UpdateInterviewFormTemplateDto,
  UpdateTranscriptSegmentDto,
  UpsertInterviewAnswerDto,
} from './dto/interview.dto';

const TERMINAL_APPLICATION_STAGES = new Set<ApplicationStage>([
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
  ApplicationStage.HIRED,
]);

const STARTABLE_APPLICATION_STAGES = new Set<ApplicationStage>([
  ApplicationStage.CONTACTED,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
]);

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async listPending(companyId: string) {
    return this.prisma.interview.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: {
          in: [
            InterviewStatus.DRAFT,
            InterviewStatus.SCHEDULED,
            InterviewStatus.IN_PROGRESS,
          ],
        },
        application: {
          deletedAt: null,
          stage: {
            in: [ApplicationStage.INTERVIEW, ApplicationStage.OFFER],
          },
        },
      },
      include: {
        interviewers: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
              },
            },
          },
        },
        application: {
          select: {
            id: true,
            stage: true,
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            vacancy: {
              select: {
                id: true,
                title: true,
                interviewFormTemplateId: true,
              },
            },
          },
        },
        _count: {
          select: { questions: true, transcripts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyProcessTemplate(
    companyId: string,
    userId: string,
    dto: ApplyProcessInterviewTemplateDto,
  ) {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: dto.vacancyId, companyId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }

    const template = await this.prisma.interviewFormTemplate.findFirst({
      where: {
        id: dto.templateId,
        companyId,
        deletedAt: null,
        status: InterviewFormStatus.ACTIVE,
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Interview form template not found');
    }

    const pending = await this.prisma.interview.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: {
          in: [
            InterviewStatus.DRAFT,
            InterviewStatus.SCHEDULED,
            InterviewStatus.IN_PROGRESS,
          ],
        },
        application: {
          vacancyId: dto.vacancyId,
          deletedAt: null,
          stage: {
            in: [ApplicationStage.INTERVIEW, ApplicationStage.OFFER],
          },
        },
      },
      select: {
        id: true,
        questions: {
          select: {
            id: true,
            answers: { select: { id: true }, take: 1 },
          },
        },
      },
    });

    const appliedTo = pending.filter((interview) =>
      interview.questions.every((question) => question.answers.length === 0),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.vacancy.update({
        where: { id: dto.vacancyId },
        data: { interviewFormTemplateId: dto.templateId },
      });

      for (const interview of appliedTo) {
        await tx.interviewQuestion.deleteMany({
          where: { interviewId: interview.id, companyId },
        });
        if (template.questions.length === 0) continue;
        await tx.interviewQuestion.createMany({
          data: template.questions.map((question) => ({
            companyId,
            interviewId: interview.id,
            sourceTemplateQuestionId: question.id,
            text: question.text,
            type: question.type,
            required: question.required,
            weight: question.weight,
            order: question.order,
          })),
        });
      }
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_TEMPLATE_UPDATED,
      entity: 'Vacancy',
      entityId: dto.vacancyId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        vacancyId: dto.vacancyId,
        templateId: dto.templateId,
        interviewsUpdated: appliedTo.length,
      },
    });

    return {
      vacancyId: dto.vacancyId,
      templateId: dto.templateId,
      interviewsUpdated: appliedTo.length,
    };
  }

  async listByApplication(companyId: string, applicationId: string) {
    await this.requireApplication(companyId, applicationId);
    return this.prisma.interview.findMany({
      where: { companyId, applicationId, deletedAt: null },
      include: {
        interviewers: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: { questions: true, transcripts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(
    companyId: string,
    id: string,
    access?: { userId: string; membershipId: string },
  ) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        interviewers: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                userId: true,
              },
            },
          },
        },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            answers: {
              select: {
                id: true,
                answerText: true,
                rating: true,
                yesNo: true,
                answeredByUserId: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        transcripts: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            sequence: true,
            speakerLabel: true,
            kind: true,
            text: true,
            createdByUserId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!interview) {
      throw new NotFoundException('Interview not found');
    }
    if (access) {
      await this.assertCanReadInterview(
        companyId,
        access.userId,
        access.membershipId,
        interview.id,
      );
    }
    return interview;
  }

  async create(
    companyId: string,
    userId: string,
    applicationId: string,
    dto: CreateInterviewDto,
  ) {
    const application = await this.requireApplication(companyId, applicationId);
    if (TERMINAL_APPLICATION_STAGES.has(application.stage)) {
      throw new BadRequestException(
        `Cannot create interview for application in stage ${application.stage}`,
      );
    }

    this.assertLocalRecordingName(dto.localRecordingName);
    const interviewerIds = [...new Set(dto.interviewerEmployeeIds)];
    await this.requireActiveInterviewers(companyId, interviewerIds);

    let templateQuestions: Array<{
      id: string;
      text: string;
      type: InterviewQuestionType;
      required: boolean;
      weight: number | null;
      order: number;
    }> = [];

    if (dto.templateId) {
      const template = await this.prisma.interviewFormTemplate.findFirst({
        where: {
          id: dto.templateId,
          companyId,
          deletedAt: null,
          status: InterviewFormStatus.ACTIVE,
        },
        include: {
          questions: { orderBy: { order: 'asc' } },
        },
      });
      if (!template) {
        throw new NotFoundException('Interview form template not found');
      }
      templateQuestions = template.questions;
    }

    const status = dto.scheduledAt
      ? InterviewStatus.SCHEDULED
      : InterviewStatus.DRAFT;

    const created = await this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          companyId,
          applicationId,
          type: dto.type,
          status,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          location: dto.location?.trim() || null,
          meetingUrl: dto.meetingUrl?.trim() || null,
          notes: dto.notes?.trim() || null,
          localRecordingName: dto.localRecordingName?.trim() || null,
          interviewers: {
            create: interviewerIds.map((employeeId) => ({ employeeId })),
          },
          questions: {
            create: templateQuestions.map((q) => ({
              companyId,
              sourceTemplateQuestionId: q.id,
              text: q.text,
              type: q.type,
              required: q.required,
              weight: q.weight,
              order: q.order,
            })),
          },
        },
      });
      return interview;
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_CREATED,
      entity: 'Interview',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId: created.id,
        applicationId,
        type: created.type,
        status: created.status,
        templateId: dto.templateId ?? null,
        interviewerCount: interviewerIds.length,
      },
    });

    return this.getById(companyId, created.id);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateInterviewDto,
  ) {
    const interview = await this.requireInterview(companyId, id);
    if (
      interview.status !== InterviewStatus.DRAFT &&
      interview.status !== InterviewStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Cannot update interview in status ${interview.status}`,
      );
    }

    this.assertLocalRecordingName(dto.localRecordingName ?? undefined);

    if (dto.interviewerEmployeeIds) {
      await this.requireActiveInterviewers(companyId, [
        ...new Set(dto.interviewerEmployeeIds),
      ]);
    }

    const nextScheduledAt =
      dto.scheduledAt === undefined
        ? interview.scheduledAt
        : dto.scheduledAt === null
          ? null
          : new Date(dto.scheduledAt);

    let nextStatus = interview.status;
    if (
      interview.status === InterviewStatus.DRAFT &&
      nextScheduledAt !== null
    ) {
      nextStatus = InterviewStatus.SCHEDULED;
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.interviewerEmployeeIds) {
        const ids = [...new Set(dto.interviewerEmployeeIds)];
        await tx.interviewInterviewer.deleteMany({
          where: { interviewId: id },
        });
        await tx.interviewInterviewer.createMany({
          data: ids.map((employeeId) => ({ interviewId: id, employeeId })),
        });
      }

      await tx.interview.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(dto.scheduledAt !== undefined
            ? {
                scheduledAt:
                  dto.scheduledAt === null ? null : new Date(dto.scheduledAt),
              }
            : {}),
          ...(dto.location !== undefined
            ? { location: dto.location?.trim() || null }
            : {}),
          ...(dto.meetingUrl !== undefined
            ? { meetingUrl: dto.meetingUrl?.trim() || null }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
          ...(dto.localRecordingName !== undefined
            ? {
                localRecordingName: dto.localRecordingName?.trim() || null,
              }
            : {}),
        },
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_UPDATED,
      entity: 'Interview',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId: id,
        status: nextStatus,
      },
    });

    return this.getById(companyId, id);
  }

  async start(
    companyId: string,
    userId: string,
    membershipId: string,
    id: string,
  ) {
    void membershipId;
    const interview = await this.requireInterview(companyId, id);
    if (interview.status !== InterviewStatus.SCHEDULED) {
      throw new BadRequestException(
        `Invalid status transition: ${interview.status} -> IN_PROGRESS`,
      );
    }

    const application = await this.requireApplication(
      companyId,
      interview.applicationId,
    );
    if (!STARTABLE_APPLICATION_STAGES.has(application.stage)) {
      throw new BadRequestException(
        `Cannot start interview while application is in stage ${application.stage}`,
      );
    }

    if (application.stage === ApplicationStage.CONTACTED) {
      await this.applicationsService.move(companyId, userId, application.id, {
        stage: ApplicationStage.INTERVIEW,
        comment: 'Interview started',
      });
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: InterviewStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_STARTED,
      entity: 'Interview',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId: id,
        applicationId: interview.applicationId,
        status: InterviewStatus.IN_PROGRESS,
      },
    });

    return updated;
  }

  async complete(companyId: string, userId: string, id: string) {
    const interview = await this.requireInterview(companyId, id);
    if (interview.status !== InterviewStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Invalid status transition: ${interview.status} -> COMPLETED`,
      );
    }

    const questions = await this.prisma.interviewQuestion.findMany({
      where: { interviewId: id, companyId, required: true },
      include: { answers: true },
    });

    const unanswered = questions.filter((q) => {
      if (q.answers.length === 0) return true;
      return !q.answers.some((a) => this.isValidAnswerPayload(q.type, a));
    });
    if (unanswered.length > 0) {
      throw new BadRequestException(
        'Cannot complete interview: required questions lack valid answers',
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: InterviewStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_COMPLETED,
      entity: 'Interview',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId: id,
        applicationId: interview.applicationId,
        status: InterviewStatus.COMPLETED,
      },
    });

    return updated;
  }

  async cancel(companyId: string, userId: string, id: string) {
    const interview = await this.requireInterview(companyId, id);
    const cancellable = new Set<InterviewStatus>([
      InterviewStatus.DRAFT,
      InterviewStatus.SCHEDULED,
      InterviewStatus.IN_PROGRESS,
    ]);
    if (!cancellable.has(interview.status)) {
      throw new BadRequestException(
        `Invalid status transition: ${interview.status} -> CANCELLED`,
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: InterviewStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_CANCELLED,
      entity: 'Interview',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId: id,
        applicationId: interview.applicationId,
        status: InterviewStatus.CANCELLED,
      },
    });

    return updated;
  }

  async upsertAnswer(
    companyId: string,
    userId: string,
    membershipId: string,
    interviewId: string,
    questionId: string,
    dto: UpsertInterviewAnswerDto,
  ) {
    const interview = await this.requireInterview(companyId, interviewId);
    if (
      interview.status === InterviewStatus.CANCELLED ||
      interview.status === InterviewStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot answer interview in status ${interview.status}`,
      );
    }

    await this.assertInterviewerOrAdmin(
      companyId,
      userId,
      membershipId,
      interviewId,
    );

    const question = await this.prisma.interviewQuestion.findFirst({
      where: { id: questionId, interviewId, companyId },
    });
    if (!question) {
      throw new NotFoundException('Interview question not found');
    }

    const payload = this.normalizeAnswerPayload(question.type, dto);

    const answer = await this.prisma.interviewAnswer.upsert({
      where: {
        interviewQuestionId_answeredByUserId: {
          interviewQuestionId: questionId,
          answeredByUserId: userId,
        },
      },
      create: {
        companyId,
        interviewQuestionId: questionId,
        answeredByUserId: userId,
        ...payload,
      },
      update: payload,
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_ANSWER_SAVED,
      entity: 'InterviewAnswer',
      entityId: answer.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId,
        questionId,
        answerId: answer.id,
        questionType: question.type,
      },
    });

    return answer;
  }

  async getTranscript(companyId: string, interviewId: string) {
    await this.requireInterview(companyId, interviewId);
    return this.prisma.interviewTranscriptSegment.findMany({
      where: { companyId, interviewId },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        sequence: true,
        speakerLabel: true,
        kind: true,
        text: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async addTranscriptSegment(
    companyId: string,
    userId: string,
    membershipId: string,
    interviewId: string,
    dto: CreateTranscriptSegmentDto,
  ) {
    const interview = await this.requireInterview(companyId, interviewId);
    if (interview.status === InterviewStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot add transcript to a cancelled interview',
      );
    }
    await this.assertInterviewerOrAdmin(
      companyId,
      userId,
      membershipId,
      interviewId,
    );

    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Transcript text is required');
    }

    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const segment = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT id FROM interviews
            WHERE id = ${interviewId}::uuid
              AND "companyId" = ${companyId}::uuid
              AND "deletedAt" IS NULL
            FOR UPDATE
          `;

          const agg = await tx.interviewTranscriptSegment.aggregate({
            where: { interviewId, companyId },
            _max: { sequence: true },
          });
          const sequence = (agg._max.sequence ?? -1) + 1;

          return tx.interviewTranscriptSegment.create({
            data: {
              companyId,
              interviewId,
              sequence,
              text,
              kind: dto.kind ?? TranscriptSegmentKind.UNCLASSIFIED,
              speakerLabel: dto.speakerLabel?.trim() || null,
              createdByUserId: userId,
            },
          });
        });

        await this.audit.create({
          action: ATS_AUDIT.TRANSCRIPT_SEGMENT_CREATED,
          entity: 'InterviewTranscriptSegment',
          entityId: segment.id,
          company: { connect: { id: companyId } },
          user: { connect: { id: userId } },
          metadata: {
            interviewId,
            segmentId: segment.id,
            sequence: segment.sequence,
            kind: segment.kind,
          },
        });

        return segment;
      } catch (error: unknown) {
        lastError = error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ConflictException('Could not allocate transcript sequence');
  }

  async updateTranscriptSegment(
    companyId: string,
    userId: string,
    membershipId: string,
    interviewId: string,
    segmentId: string,
    dto: UpdateTranscriptSegmentDto,
  ) {
    await this.requireInterview(companyId, interviewId);
    await this.assertInterviewerOrAdmin(
      companyId,
      userId,
      membershipId,
      interviewId,
    );

    const existing = await this.prisma.interviewTranscriptSegment.findFirst({
      where: { id: segmentId, interviewId, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Transcript segment not found');
    }

    const updated = await this.prisma.interviewTranscriptSegment.update({
      where: { id: segmentId },
      data: {
        ...(dto.text !== undefined ? { text: dto.text.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.speakerLabel !== undefined
          ? { speakerLabel: dto.speakerLabel?.trim() || null }
          : {}),
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.TRANSCRIPT_SEGMENT_UPDATED,
      entity: 'InterviewTranscriptSegment',
      entityId: segmentId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId,
        segmentId,
        kind: updated.kind,
      },
    });

    return updated;
  }

  async deleteTranscriptSegment(
    companyId: string,
    userId: string,
    membershipId: string,
    interviewId: string,
    segmentId: string,
  ) {
    await this.requireInterview(companyId, interviewId);
    await this.assertInterviewerOrAdmin(
      companyId,
      userId,
      membershipId,
      interviewId,
    );

    const existing = await this.prisma.interviewTranscriptSegment.findFirst({
      where: { id: segmentId, interviewId, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Transcript segment not found');
    }

    await this.prisma.interviewTranscriptSegment.delete({
      where: { id: segmentId },
    });

    await this.audit.create({
      action: ATS_AUDIT.TRANSCRIPT_SEGMENT_REMOVED,
      entity: 'InterviewTranscriptSegment',
      entityId: segmentId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        interviewId,
        segmentId,
        sequence: existing.sequence,
      },
    });

    return { deleted: true };
  }

  async listTemplates(companyId: string) {
    return this.prisma.interviewFormTemplate.findMany({
      where: { companyId, deletedAt: null },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTemplate(companyId: string, id: string) {
    const template = await this.prisma.interviewFormTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!template) {
      throw new NotFoundException('Interview form template not found');
    }
    return template;
  }

  async createTemplate(
    companyId: string,
    userId: string,
    dto: CreateInterviewFormTemplateDto,
  ) {
    const questions = dto.questions ?? [];
    const orders = questions.map((q) => q.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Question orders must be unique');
    }

    const created = await this.prisma.interviewFormTemplate.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        status: InterviewFormStatus.ACTIVE,
        questions: {
          create: questions.map((q) => ({
            companyId,
            text: q.text.trim(),
            type: q.type,
            required: q.required ?? true,
            weight: q.weight ?? null,
            order: q.order,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_TEMPLATE_CREATED,
      entity: 'InterviewFormTemplate',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        templateId: created.id,
        type: created.type,
        questionCount: questions.length,
      },
    });

    return created;
  }

  async updateTemplate(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateInterviewFormTemplateDto,
  ) {
    await this.getTemplate(companyId, id);

    const updated = await this.prisma.interviewFormTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    await this.audit.create({
      action: ATS_AUDIT.INTERVIEW_TEMPLATE_UPDATED,
      entity: 'InterviewFormTemplate',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        templateId: id,
        status: updated.status,
        type: updated.type,
      },
    });

    return updated;
  }

  async addTemplateQuestion(
    companyId: string,
    userId: string,
    templateId: string,
    dto: AddTemplateQuestionDto,
  ) {
    await this.getTemplate(companyId, templateId);

    try {
      const question = await this.prisma.interviewFormQuestion.create({
        data: {
          companyId,
          templateId,
          text: dto.text.trim(),
          type: dto.type,
          required: dto.required ?? true,
          weight: dto.weight ?? null,
          order: dto.order,
        },
      });

      await this.audit.create({
        action: ATS_AUDIT.INTERVIEW_TEMPLATE_UPDATED,
        entity: 'InterviewFormTemplate',
        entityId: templateId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          templateId,
          questionId: question.id,
          action: 'QUESTION_ADDED',
        },
      });

      return question;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A question with the same order already exists on this template',
        );
      }
      throw error;
    }
  }

  private async requireApplication(companyId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  private async requireInterview(companyId: string, id: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!interview) {
      throw new NotFoundException('Interview not found');
    }
    return interview;
  }

  private async requireActiveInterviewers(
    companyId: string,
    employeeIds: string[],
  ) {
    if (employeeIds.length === 0) {
      throw new BadRequestException('At least one interviewer is required');
    }
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        companyId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
    });
    if (employees.length !== employeeIds.length) {
      throw new BadRequestException(
        'All interviewers must be ACTIVE employees in the current company',
      );
    }
  }

  private async assertCanReadInterview(
    companyId: string,
    userId: string,
    membershipId: string,
    interviewId: string,
  ) {
    const permissions =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (permissions.has('ats.interview.read')) return;
    await this.assertInterviewerOrAdmin(
      companyId,
      userId,
      membershipId,
      interviewId,
    );
  }

  private async assertInterviewerOrAdmin(
    companyId: string,
    userId: string,
    membershipId: string,
    interviewId: string,
  ) {
    const isAdmin = await this.rbac.membershipHasRoleCode(
      membershipId,
      TEMP_APPROVER_ROLE_CODE,
    );
    if (isAdmin) return;

    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId,
        userId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
    });
    if (!employee) {
      throw new ForbiddenException(
        'Only interviewers or CLIENT_ADMIN can perform this action',
      );
    }

    const assignment = await this.prisma.interviewInterviewer.findUnique({
      where: {
        interviewId_employeeId: {
          interviewId,
          employeeId: employee.id,
        },
      },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Only interviewers or CLIENT_ADMIN can perform this action',
      );
    }
  }

  private assertLocalRecordingName(value?: string | null) {
    if (value == null || value === '') return;
    const trimmed = value.trim();
    if (
      trimmed.includes('/') ||
      trimmed.includes('\\') ||
      trimmed.toLowerCase().startsWith('file:')
    ) {
      throw new BadRequestException(
        'localRecordingName must be a display name, not a filesystem path',
      );
    }
  }

  private normalizeAnswerPayload(
    type: InterviewQuestionType,
    dto: UpsertInterviewAnswerDto,
  ): {
    answerText: string | null;
    rating: number | null;
    yesNo: boolean | null;
  } {
    switch (type) {
      case InterviewQuestionType.TEXT:
      case InterviewQuestionType.TEXTAREA: {
        if (dto.answerText == null || !dto.answerText.trim()) {
          throw new BadRequestException(
            'answerText is required for this question type',
          );
        }
        if (dto.rating !== undefined || dto.yesNo !== undefined) {
          throw new BadRequestException(
            'Only answerText is allowed for TEXT/TEXTAREA questions',
          );
        }
        return {
          answerText: dto.answerText.trim(),
          rating: null,
          yesNo: null,
        };
      }
      case InterviewQuestionType.RATING: {
        if (dto.rating == null) {
          throw new BadRequestException(
            'rating is required for RATING questions',
          );
        }
        if (dto.answerText !== undefined || dto.yesNo !== undefined) {
          throw new BadRequestException(
            'Only rating is allowed for RATING questions',
          );
        }
        return { answerText: null, rating: dto.rating, yesNo: null };
      }
      case InterviewQuestionType.YES_NO: {
        if (dto.yesNo == null) {
          throw new BadRequestException(
            'yesNo is required for YES_NO questions',
          );
        }
        if (dto.answerText !== undefined || dto.rating !== undefined) {
          throw new BadRequestException(
            'Only yesNo is allowed for YES_NO questions',
          );
        }
        return { answerText: null, rating: null, yesNo: dto.yesNo };
      }
      default:
        throw new BadRequestException('Unsupported question type');
    }
  }

  private isValidAnswerPayload(
    type: InterviewQuestionType,
    answer: {
      answerText: string | null;
      rating: number | null;
      yesNo: boolean | null;
    },
  ): boolean {
    switch (type) {
      case InterviewQuestionType.TEXT:
      case InterviewQuestionType.TEXTAREA:
        return !!answer.answerText?.trim();
      case InterviewQuestionType.RATING:
        return (
          answer.rating != null && answer.rating >= 1 && answer.rating <= 5
        );
      case InterviewQuestionType.YES_NO:
        return answer.yesNo === true || answer.yesNo === false;
      default:
        return false;
    }
  }
}
