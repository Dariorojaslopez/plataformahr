import { type Application } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateApplicationDto, ListApplicationsQueryDto, MoveApplicationDto } from './dto/application.dto';
export declare class ApplicationsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(companyId: string, query: ListApplicationsQueryDto): Promise<{
        items: ({
            vacancy: {
                area: {
                    name: string;
                    id: string;
                };
                position: {
                    name: string;
                    id: string;
                };
                id: string;
                status: import("@prisma/client").$Enums.VacancyStatus;
                title: string;
            };
            candidate: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
                status: import("@prisma/client").$Enums.CandidateStatus;
            };
        } & {
            id: string;
            companyId: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ApplicationStatus;
            updatedAt: Date;
            deletedAt: Date | null;
            candidateId: string;
            vacancyId: string;
            stage: import("@prisma/client").$Enums.ApplicationStage;
            appliedAt: Date;
            lastStageChangedAt: Date;
        })[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getById(companyId: string, id: string): Promise<{
        vacancy: {
            area: {
                name: string;
                id: string;
            };
            position: {
                name: string;
                id: string;
            };
            id: string;
            status: import("@prisma/client").$Enums.VacancyStatus;
            title: string;
        };
        candidate: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.CandidateStatus;
            phone: string | null;
        };
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.ApplicationStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        candidateId: string;
        vacancyId: string;
        stage: import("@prisma/client").$Enums.ApplicationStage;
        appliedAt: Date;
        lastStageChangedAt: Date;
    }>;
    create(companyId: string, userId: string, dto: CreateApplicationDto): Promise<Application>;
    move(companyId: string, userId: string, id: string, dto: MoveApplicationDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.ApplicationStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        candidateId: string;
        vacancyId: string;
        stage: import("@prisma/client").$Enums.ApplicationStage;
        appliedAt: Date;
        lastStageChangedAt: Date;
    }>;
    history(companyId: string, applicationId: string): Promise<{
        id: string;
        createdAt: Date;
        comment: string | null;
        toStage: import("@prisma/client").$Enums.ApplicationStage;
        fromStage: import("@prisma/client").$Enums.ApplicationStage | null;
        changedByUserId: string;
    }[]>;
    pipeline(companyId: string, vacancyId: string): Promise<{
        vacancy: {
            id: string;
            status: import("@prisma/client").$Enums.VacancyStatus;
            title: string;
        };
        columns: {
            stage: "PENDING_REVIEW" | "CONTACTED" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED" | "WITHDRAWN";
            count: number;
            applications: {
                applicationId: string;
                candidateId: string;
                candidateName: string;
                candidateEmail: string;
                stage: import("@prisma/client").$Enums.ApplicationStage;
                lastStageChangedAt: Date;
            }[];
        }[];
    }>;
}
