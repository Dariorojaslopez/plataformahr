"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const rbac_service_1 = require("../../core/rbac/rbac.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const applications_service_1 = require("../applications/applications.service");
const ats_constants_1 = require("../ats.constants");
const TERMINAL_APPLICATION_STAGES = new Set([
    client_1.ApplicationStage.REJECTED,
    client_1.ApplicationStage.WITHDRAWN,
    client_1.ApplicationStage.HIRED,
]);
const STARTABLE_APPLICATION_STAGES = new Set([
    client_1.ApplicationStage.CONTACTED,
    client_1.ApplicationStage.INTERVIEW,
]);
let InterviewsService = class InterviewsService {
    prisma;
    audit;
    rbac;
    applicationsService;
    constructor(prisma, audit, rbac, applicationsService) {
        this.prisma = prisma;
        this.audit = audit;
        this.rbac = rbac;
        this.applicationsService = applicationsService;
    }
    async listByApplication(companyId, applicationId) {
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
    async getById(companyId, id) {
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
            throw new common_1.NotFoundException('Interview not found');
        }
        return interview;
    }
    async create(companyId, userId, applicationId, dto) {
        const application = await this.requireApplication(companyId, applicationId);
        if (TERMINAL_APPLICATION_STAGES.has(application.stage)) {
            throw new common_1.BadRequestException(`Cannot create interview for application in stage ${application.stage}`);
        }
        this.assertLocalRecordingName(dto.localRecordingName);
        const interviewerIds = [...new Set(dto.interviewerEmployeeIds)];
        await this.requireActiveInterviewers(companyId, interviewerIds);
        let templateQuestions = [];
        if (dto.templateId) {
            const template = await this.prisma.interviewFormTemplate.findFirst({
                where: {
                    id: dto.templateId,
                    companyId,
                    deletedAt: null,
                    status: client_1.InterviewFormStatus.ACTIVE,
                },
                include: {
                    questions: { orderBy: { order: 'asc' } },
                },
            });
            if (!template) {
                throw new common_1.NotFoundException('Interview form template not found');
            }
            templateQuestions = template.questions;
        }
        const status = dto.scheduledAt
            ? client_1.InterviewStatus.SCHEDULED
            : client_1.InterviewStatus.DRAFT;
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
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_CREATED,
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
    async update(companyId, userId, id, dto) {
        const interview = await this.requireInterview(companyId, id);
        if (interview.status !== client_1.InterviewStatus.DRAFT &&
            interview.status !== client_1.InterviewStatus.SCHEDULED) {
            throw new common_1.BadRequestException(`Cannot update interview in status ${interview.status}`);
        }
        this.assertLocalRecordingName(dto.localRecordingName ?? undefined);
        if (dto.interviewerEmployeeIds) {
            await this.requireActiveInterviewers(companyId, [
                ...new Set(dto.interviewerEmployeeIds),
            ]);
        }
        const nextScheduledAt = dto.scheduledAt === undefined
            ? interview.scheduledAt
            : dto.scheduledAt === null
                ? null
                : new Date(dto.scheduledAt);
        let nextStatus = interview.status;
        if (interview.status === client_1.InterviewStatus.DRAFT &&
            nextScheduledAt !== null) {
            nextStatus = client_1.InterviewStatus.SCHEDULED;
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
                            scheduledAt: dto.scheduledAt === null ? null : new Date(dto.scheduledAt),
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
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_UPDATED,
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
    async start(companyId, userId, membershipId, id) {
        void membershipId;
        const interview = await this.requireInterview(companyId, id);
        if (interview.status !== client_1.InterviewStatus.SCHEDULED) {
            throw new common_1.BadRequestException(`Invalid status transition: ${interview.status} -> IN_PROGRESS`);
        }
        const application = await this.requireApplication(companyId, interview.applicationId);
        if (!STARTABLE_APPLICATION_STAGES.has(application.stage)) {
            throw new common_1.BadRequestException(`Cannot start interview while application is in stage ${application.stage}`);
        }
        if (application.stage === client_1.ApplicationStage.CONTACTED) {
            await this.applicationsService.move(companyId, userId, application.id, {
                stage: client_1.ApplicationStage.INTERVIEW,
                comment: 'Interview started',
            });
        }
        const updated = await this.prisma.interview.update({
            where: { id },
            data: {
                status: client_1.InterviewStatus.IN_PROGRESS,
                startedAt: new Date(),
            },
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_STARTED,
            entity: 'Interview',
            entityId: id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: {
                interviewId: id,
                applicationId: interview.applicationId,
                status: client_1.InterviewStatus.IN_PROGRESS,
            },
        });
        return updated;
    }
    async complete(companyId, userId, id) {
        const interview = await this.requireInterview(companyId, id);
        if (interview.status !== client_1.InterviewStatus.IN_PROGRESS) {
            throw new common_1.BadRequestException(`Invalid status transition: ${interview.status} -> COMPLETED`);
        }
        const questions = await this.prisma.interviewQuestion.findMany({
            where: { interviewId: id, companyId, required: true },
            include: { answers: true },
        });
        const unanswered = questions.filter((q) => {
            if (q.answers.length === 0)
                return true;
            return !q.answers.some((a) => this.isValidAnswerPayload(q.type, a));
        });
        if (unanswered.length > 0) {
            throw new common_1.BadRequestException('Cannot complete interview: required questions lack valid answers');
        }
        const updated = await this.prisma.interview.update({
            where: { id },
            data: {
                status: client_1.InterviewStatus.COMPLETED,
                completedAt: new Date(),
            },
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_COMPLETED,
            entity: 'Interview',
            entityId: id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: {
                interviewId: id,
                applicationId: interview.applicationId,
                status: client_1.InterviewStatus.COMPLETED,
            },
        });
        return updated;
    }
    async cancel(companyId, userId, id) {
        const interview = await this.requireInterview(companyId, id);
        const cancellable = new Set([
            client_1.InterviewStatus.DRAFT,
            client_1.InterviewStatus.SCHEDULED,
            client_1.InterviewStatus.IN_PROGRESS,
        ]);
        if (!cancellable.has(interview.status)) {
            throw new common_1.BadRequestException(`Invalid status transition: ${interview.status} -> CANCELLED`);
        }
        const updated = await this.prisma.interview.update({
            where: { id },
            data: {
                status: client_1.InterviewStatus.CANCELLED,
                cancelledAt: new Date(),
            },
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_CANCELLED,
            entity: 'Interview',
            entityId: id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: {
                interviewId: id,
                applicationId: interview.applicationId,
                status: client_1.InterviewStatus.CANCELLED,
            },
        });
        return updated;
    }
    async upsertAnswer(companyId, userId, membershipId, interviewId, questionId, dto) {
        const interview = await this.requireInterview(companyId, interviewId);
        if (interview.status === client_1.InterviewStatus.CANCELLED ||
            interview.status === client_1.InterviewStatus.COMPLETED) {
            throw new common_1.BadRequestException(`Cannot answer interview in status ${interview.status}`);
        }
        await this.assertInterviewerOrAdmin(companyId, userId, membershipId, interviewId);
        const question = await this.prisma.interviewQuestion.findFirst({
            where: { id: questionId, interviewId, companyId },
        });
        if (!question) {
            throw new common_1.NotFoundException('Interview question not found');
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
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_ANSWER_SAVED,
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
    async getTranscript(companyId, interviewId) {
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
    async addTranscriptSegment(companyId, userId, membershipId, interviewId, dto) {
        const interview = await this.requireInterview(companyId, interviewId);
        if (interview.status === client_1.InterviewStatus.CANCELLED) {
            throw new common_1.BadRequestException('Cannot add transcript to a cancelled interview');
        }
        await this.assertInterviewerOrAdmin(companyId, userId, membershipId, interviewId);
        const text = dto.text.trim();
        if (!text) {
            throw new common_1.BadRequestException('Transcript text is required');
        }
        const maxAttempts = 3;
        let lastError;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            try {
                const segment = await this.prisma.$transaction(async (tx) => {
                    await tx.$queryRaw `
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
                            kind: dto.kind ?? client_1.TranscriptSegmentKind.UNCLASSIFIED,
                            speakerLabel: dto.speakerLabel?.trim() || null,
                            createdByUserId: userId,
                        },
                    });
                });
                await this.audit.create({
                    action: ats_constants_1.ATS_AUDIT.TRANSCRIPT_SEGMENT_CREATED,
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
            }
            catch (error) {
                lastError = error;
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    error.code === 'P2002') {
                    continue;
                }
                throw error;
            }
        }
        throw lastError instanceof Error
            ? lastError
            : new common_1.ConflictException('Could not allocate transcript sequence');
    }
    async updateTranscriptSegment(companyId, userId, membershipId, interviewId, segmentId, dto) {
        await this.requireInterview(companyId, interviewId);
        await this.assertInterviewerOrAdmin(companyId, userId, membershipId, interviewId);
        const existing = await this.prisma.interviewTranscriptSegment.findFirst({
            where: { id: segmentId, interviewId, companyId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Transcript segment not found');
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
            action: ats_constants_1.ATS_AUDIT.TRANSCRIPT_SEGMENT_UPDATED,
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
    async deleteTranscriptSegment(companyId, userId, membershipId, interviewId, segmentId) {
        await this.requireInterview(companyId, interviewId);
        await this.assertInterviewerOrAdmin(companyId, userId, membershipId, interviewId);
        const existing = await this.prisma.interviewTranscriptSegment.findFirst({
            where: { id: segmentId, interviewId, companyId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Transcript segment not found');
        }
        await this.prisma.interviewTranscriptSegment.delete({
            where: { id: segmentId },
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.TRANSCRIPT_SEGMENT_REMOVED,
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
    async listTemplates(companyId) {
        return this.prisma.interviewFormTemplate.findMany({
            where: { companyId, deletedAt: null },
            include: {
                questions: { orderBy: { order: 'asc' } },
            },
            orderBy: { name: 'asc' },
        });
    }
    async getTemplate(companyId, id) {
        const template = await this.prisma.interviewFormTemplate.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                questions: { orderBy: { order: 'asc' } },
            },
        });
        if (!template) {
            throw new common_1.NotFoundException('Interview form template not found');
        }
        return template;
    }
    async createTemplate(companyId, userId, dto) {
        const questions = dto.questions ?? [];
        const orders = questions.map((q) => q.order);
        if (new Set(orders).size !== orders.length) {
            throw new common_1.BadRequestException('Question orders must be unique');
        }
        const created = await this.prisma.interviewFormTemplate.create({
            data: {
                companyId,
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
                type: dto.type,
                status: client_1.InterviewFormStatus.ACTIVE,
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
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_TEMPLATE_CREATED,
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
    async updateTemplate(companyId, userId, id, dto) {
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
            action: ats_constants_1.ATS_AUDIT.INTERVIEW_TEMPLATE_UPDATED,
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
    async addTemplateQuestion(companyId, userId, templateId, dto) {
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
                action: ats_constants_1.ATS_AUDIT.INTERVIEW_TEMPLATE_UPDATED,
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
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('A question with the same order already exists on this template');
            }
            throw error;
        }
    }
    async requireApplication(companyId, applicationId) {
        const application = await this.prisma.application.findFirst({
            where: { id: applicationId, companyId, deletedAt: null },
        });
        if (!application) {
            throw new common_1.NotFoundException('Application not found');
        }
        return application;
    }
    async requireInterview(companyId, id) {
        const interview = await this.prisma.interview.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!interview) {
            throw new common_1.NotFoundException('Interview not found');
        }
        return interview;
    }
    async requireActiveInterviewers(companyId, employeeIds) {
        if (employeeIds.length === 0) {
            throw new common_1.BadRequestException('At least one interviewer is required');
        }
        const employees = await this.prisma.employee.findMany({
            where: {
                id: { in: employeeIds },
                companyId,
                deletedAt: null,
                status: client_1.EmployeeStatus.ACTIVE,
            },
        });
        if (employees.length !== employeeIds.length) {
            throw new common_1.BadRequestException('All interviewers must be ACTIVE employees in the current company');
        }
    }
    async assertInterviewerOrAdmin(companyId, userId, membershipId, interviewId) {
        const isAdmin = await this.rbac.membershipHasRoleCode(membershipId, ats_constants_1.TEMP_APPROVER_ROLE_CODE);
        if (isAdmin)
            return;
        const employee = await this.prisma.employee.findFirst({
            where: {
                companyId,
                userId,
                deletedAt: null,
                status: client_1.EmployeeStatus.ACTIVE,
            },
        });
        if (!employee) {
            throw new common_1.ForbiddenException('Only interviewers or CLIENT_ADMIN can perform this action');
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
            throw new common_1.ForbiddenException('Only interviewers or CLIENT_ADMIN can perform this action');
        }
    }
    assertLocalRecordingName(value) {
        if (value == null || value === '')
            return;
        const trimmed = value.trim();
        if (trimmed.includes('/') ||
            trimmed.includes('\\') ||
            trimmed.toLowerCase().startsWith('file:')) {
            throw new common_1.BadRequestException('localRecordingName must be a display name, not a filesystem path');
        }
    }
    normalizeAnswerPayload(type, dto) {
        switch (type) {
            case client_1.InterviewQuestionType.TEXT:
            case client_1.InterviewQuestionType.TEXTAREA: {
                if (dto.answerText == null || !dto.answerText.trim()) {
                    throw new common_1.BadRequestException('answerText is required for this question type');
                }
                if (dto.rating !== undefined || dto.yesNo !== undefined) {
                    throw new common_1.BadRequestException('Only answerText is allowed for TEXT/TEXTAREA questions');
                }
                return {
                    answerText: dto.answerText.trim(),
                    rating: null,
                    yesNo: null,
                };
            }
            case client_1.InterviewQuestionType.RATING: {
                if (dto.rating == null) {
                    throw new common_1.BadRequestException('rating is required for RATING questions');
                }
                if (dto.answerText !== undefined || dto.yesNo !== undefined) {
                    throw new common_1.BadRequestException('Only rating is allowed for RATING questions');
                }
                return { answerText: null, rating: dto.rating, yesNo: null };
            }
            case client_1.InterviewQuestionType.YES_NO: {
                if (dto.yesNo == null) {
                    throw new common_1.BadRequestException('yesNo is required for YES_NO questions');
                }
                if (dto.answerText !== undefined || dto.rating !== undefined) {
                    throw new common_1.BadRequestException('Only yesNo is allowed for YES_NO questions');
                }
                return { answerText: null, rating: null, yesNo: dto.yesNo };
            }
            default:
                throw new common_1.BadRequestException('Unsupported question type');
        }
    }
    isValidAnswerPayload(type, answer) {
        switch (type) {
            case client_1.InterviewQuestionType.TEXT:
            case client_1.InterviewQuestionType.TEXTAREA:
                return !!answer.answerText?.trim();
            case client_1.InterviewQuestionType.RATING:
                return (answer.rating != null && answer.rating >= 1 && answer.rating <= 5);
            case client_1.InterviewQuestionType.YES_NO:
                return answer.yesNo === true || answer.yesNo === false;
            default:
                return false;
        }
    }
};
exports.InterviewsService = InterviewsService;
exports.InterviewsService = InterviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        rbac_service_1.RbacService,
        applications_service_1.ApplicationsService])
], InterviewsService);
//# sourceMappingURL=interviews.service.js.map