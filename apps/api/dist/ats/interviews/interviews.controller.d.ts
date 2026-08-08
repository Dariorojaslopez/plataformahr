import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CreateTranscriptSegmentDto, UpdateInterviewDto, UpdateTranscriptSegmentDto, UpsertInterviewAnswerDto } from './dto/interview.dto';
import { InterviewsService } from './interviews.service';
export declare class InterviewsController {
    private readonly interviewsService;
    constructor(interviewsService: InterviewsService);
    getById(tenant: TenantContext, id: string): Promise<{
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
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateInterviewDto): Promise<{
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
    start(tenant: TenantContext, user: AuthenticatedUser, id: string): Promise<{
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
    complete(tenant: TenantContext, user: AuthenticatedUser, id: string): Promise<{
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
    cancel(tenant: TenantContext, user: AuthenticatedUser, id: string): Promise<{
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
    upsertAnswer(tenant: TenantContext, user: AuthenticatedUser, id: string, questionId: string, dto: UpsertInterviewAnswerDto): Promise<{
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
    getTranscript(tenant: TenantContext, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        kind: import("@prisma/client").$Enums.TranscriptSegmentKind;
        speakerLabel: string | null;
        sequence: number;
        createdByUserId: string;
    }[]>;
    addSegment(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: CreateTranscriptSegmentDto): Promise<{
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
    updateSegment(tenant: TenantContext, user: AuthenticatedUser, id: string, segmentId: string, dto: UpdateTranscriptSegmentDto): Promise<{
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
    deleteSegment(tenant: TenantContext, user: AuthenticatedUser, id: string, segmentId: string): Promise<{
        deleted: boolean;
    }>;
}
