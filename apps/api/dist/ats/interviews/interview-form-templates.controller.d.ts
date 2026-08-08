import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { AddTemplateQuestionDto, CreateInterviewFormTemplateDto, UpdateInterviewFormTemplateDto } from './dto/interview.dto';
import { InterviewsService } from './interviews.service';
export declare class InterviewFormTemplatesController {
    private readonly interviewsService;
    constructor(interviewsService: InterviewsService);
    list(tenant: TenantContext): Promise<({
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
    getById(tenant: TenantContext, id: string): Promise<{
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
    create(tenant: TenantContext, user: AuthenticatedUser, dto: CreateInterviewFormTemplateDto): Promise<{
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
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateInterviewFormTemplateDto): Promise<{
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
    addQuestion(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: AddTemplateQuestionDto): Promise<{
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
}
