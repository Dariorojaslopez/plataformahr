import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CreateApplicationDto, ListApplicationsQueryDto, MoveApplicationDto } from './dto/application.dto';
import { ApplicationsService } from './applications.service';
export declare class ApplicationsController {
    private readonly applicationsService;
    constructor(applicationsService: ApplicationsService);
    list(tenant: TenantContext, query: ListApplicationsQueryDto): Promise<{
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
    getById(tenant: TenantContext, id: string): Promise<{
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
    history(tenant: TenantContext, id: string): Promise<{
        id: string;
        createdAt: Date;
        comment: string | null;
        toStage: import("@prisma/client").$Enums.ApplicationStage;
        fromStage: import("@prisma/client").$Enums.ApplicationStage | null;
        changedByUserId: string;
    }[]>;
    create(tenant: TenantContext, user: AuthenticatedUser, dto: CreateApplicationDto): Promise<{
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
    move(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: MoveApplicationDto): Promise<{
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
}
