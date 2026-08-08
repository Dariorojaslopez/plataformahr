import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { ListVacanciesQueryDto, UpdateVacancyDto } from './dto/vacancy.dto';
import { VacanciesService } from './vacancies.service';
export declare class VacanciesController {
    private readonly vacanciesService;
    constructor(vacanciesService: VacanciesService);
    list(tenant: TenantContext, query: ListVacanciesQueryDto): Promise<{
        items: ({
            area: {
                name: string;
                id: string;
            };
            position: {
                name: string;
                id: string;
                headcount: number;
            };
        } & {
            id: string;
            companyId: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.VacancyStatus;
            updatedAt: Date;
            deletedAt: Date | null;
            description: string | null;
            areaId: string;
            headcount: number;
            positionId: string;
            vacancyRequestId: string;
            title: string;
            filledCount: number;
            openedAt: Date;
            closedAt: Date | null;
        })[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getById(tenant: TenantContext, id: string): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.VacancyStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        description: string | null;
        areaId: string;
        headcount: number;
        positionId: string;
        vacancyRequestId: string;
        title: string;
        filledCount: number;
        openedAt: Date;
        closedAt: Date | null;
    }>;
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateVacancyDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.VacancyStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        description: string | null;
        areaId: string;
        headcount: number;
        positionId: string;
        vacancyRequestId: string;
        title: string;
        filledCount: number;
        openedAt: Date;
        closedAt: Date | null;
    }>;
}
