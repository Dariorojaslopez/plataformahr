import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CreateInterviewDto } from './dto/interview.dto';
import { InterviewsService } from './interviews.service';
export declare class ApplicationInterviewsController {
    private readonly interviewsService;
    constructor(interviewsService: InterviewsService);
    list(tenant: TenantContext, applicationId: string): Promise<({
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
    create(tenant: TenantContext, user: AuthenticatedUser, applicationId: string, dto: CreateInterviewDto): Promise<{
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
}
