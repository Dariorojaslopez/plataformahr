import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import type { AddTemplateQuestionDto, CreateInterviewDto, CreateInterviewFormTemplateDto, CreateTranscriptSegmentDto, UpdateInterviewDto, UpdateInterviewFormTemplateDto, UpdateTranscriptSegmentDto, UpsertInterviewAnswerDto } from './dto/interview.dto';
export declare class InterviewsService {
    private readonly prisma;
    private readonly audit;
    private readonly rbac;
    private readonly applicationsService;
    constructor(prisma: PrismaService, audit: AuditService, rbac: RbacService, applicationsService: ApplicationsService);
    listByApplication(companyId: string, applicationId: string): Promise<({
        _count: {
            questions: number;
            transcripts: number;
        };
        interviewers: ({
            employee: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
                status: import("@prisma/client").$Enums.EmployeeStatus;
            };
        } & {
            createdAt: Date;
            interviewId: string;
            employeeId: string;
        })[];
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    })[]>;
    getById(companyId: string, id: string): Promise<{
        questions: ({
            answers: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                answerText: string | null;
                rating: number | null;
                yesNo: boolean | null;
                answeredByUserId: string;
            }[];
        } & {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
            interviewId: string;
            sourceTemplateQuestionId: string | null;
        })[];
        interviewers: ({
            employee: {
                id: string;
                userId: string | null;
                email: string;
                firstName: string;
                lastName: string;
                status: import("@prisma/client").$Enums.EmployeeStatus;
            };
        } & {
            createdAt: Date;
            interviewId: string;
            employeeId: string;
        })[];
        transcripts: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            text: string;
            kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
            speakerLabel: string | null;
            sequence: number;
            createdByUserId: string;
        }[];
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    }>;
    create(companyId: string, userId: string, applicationId: string, dto: CreateInterviewDto): Promise<{
        questions: ({
            answers: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                answerText: string | null;
                rating: number | null;
                yesNo: boolean | null;
                answeredByUserId: string;
            }[];
        } & {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
            interviewId: string;
            sourceTemplateQuestionId: string | null;
        })[];
        interviewers: ({
            employee: {
                id: string;
                userId: string | null;
                email: string;
                firstName: string;
                lastName: string;
                status: import("@prisma/client").$Enums.EmployeeStatus;
            };
        } & {
            createdAt: Date;
            interviewId: string;
            employeeId: string;
        })[];
        transcripts: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            text: string;
            kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
            speakerLabel: string | null;
            sequence: number;
            createdByUserId: string;
        }[];
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    }>;
    update(companyId: string, userId: string, id: string, dto: UpdateInterviewDto): Promise<{
        questions: ({
            answers: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                answerText: string | null;
                rating: number | null;
                yesNo: boolean | null;
                answeredByUserId: string;
            }[];
        } & {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
            interviewId: string;
            sourceTemplateQuestionId: string | null;
        })[];
        interviewers: ({
            employee: {
                id: string;
                userId: string | null;
                email: string;
                firstName: string;
                lastName: string;
                status: import("@prisma/client").$Enums.EmployeeStatus;
            };
        } & {
            createdAt: Date;
            interviewId: string;
            employeeId: string;
        })[];
        transcripts: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            text: string;
            kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
            speakerLabel: string | null;
            sequence: number;
            createdByUserId: string;
        }[];
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    }>;
    start(companyId: string, userId: string, membershipId: string, id: string): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    }>;
    complete(companyId: string, userId: string, id: string): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    }>;
    cancel(companyId: string, userId: string, id: string): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        applicationId: string;
        scheduledAt: Date | null;
        location: string | null;
        meetingUrl: string | null;
        notes: string | null;
        localRecordingName: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
    }>;
    upsertAnswer(companyId: string, userId: string, membershipId: string, interviewId: string, questionId: string, dto: UpsertInterviewAnswerDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        updatedAt: Date;
        answerText: string | null;
        rating: number | null;
        yesNo: boolean | null;
        interviewQuestionId: string;
        answeredByUserId: string;
    }>;
    getTranscript(companyId: string, interviewId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
        speakerLabel: string | null;
        sequence: number;
        createdByUserId: string;
    }[]>;
    addTranscriptSegment(companyId: string, userId: string, membershipId: string, interviewId: string, dto: CreateTranscriptSegmentDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
        speakerLabel: string | null;
        sequence: number;
        interviewId: string;
        createdByUserId: string;
    }>;
    updateTranscriptSegment(companyId: string, userId: string, membershipId: string, interviewId: string, segmentId: string, dto: UpdateTranscriptSegmentDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
        speakerLabel: string | null;
        sequence: number;
        interviewId: string;
        createdByUserId: string;
    }>;
    deleteTranscriptSegment(companyId: string, userId: string, membershipId: string, interviewId: string, segmentId: string): Promise<{
        deleted: boolean;
    }>;
    listTemplates(companyId: string): Promise<({
        questions: {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            updatedAt: Date;
            templateId: string;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
        }[];
    } & {
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewFormStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        description: string | null;
    })[]>;
    getTemplate(companyId: string, id: string): Promise<{
        questions: {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            updatedAt: Date;
            templateId: string;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
        }[];
    } & {
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewFormStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        description: string | null;
    }>;
    createTemplate(companyId: string, userId: string, dto: CreateInterviewFormTemplateDto): Promise<{
        questions: {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            updatedAt: Date;
            templateId: string;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
        }[];
    } & {
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewFormStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        description: string | null;
    }>;
    updateTemplate(companyId: string, userId: string, id: string, dto: UpdateInterviewFormTemplateDto): Promise<{
        questions: {
            id: string;
            companyId: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.InterviewQuestionType;
            updatedAt: Date;
            templateId: string;
            text: string;
            required: boolean;
            weight: number | null;
            order: number;
        }[];
    } & {
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewType;
        status: import("@prisma/client").$Enums.InterviewFormStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        description: string | null;
    }>;
    addTemplateQuestion(companyId: string, userId: string, templateId: string, dto: AddTemplateQuestionDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.InterviewQuestionType;
        updatedAt: Date;
        templateId: string;
        text: string;
        required: boolean;
        weight: number | null;
        order: number;
    }>;
    private requireApplication;
    private requireInterview;
    private requireActiveInterviewers;
    private assertInterviewerOrAdmin;
    private assertLocalRecordingName;
    private normalizeAnswerPayload;
    private isValidAnswerPayload;
}
