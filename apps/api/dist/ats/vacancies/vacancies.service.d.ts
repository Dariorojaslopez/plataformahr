import { type Vacancy } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListVacanciesQueryDto, UpdateVacancyDto } from './dto/vacancy.dto';
export declare class VacanciesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(companyId: string, query: ListVacanciesQueryDto): Promise<{
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
    getById(companyId: string, id: string): Promise<Vacancy>;
    update(companyId: string, userId: string, id: string, dto: UpdateVacancyDto): Promise<Vacancy>;
}
