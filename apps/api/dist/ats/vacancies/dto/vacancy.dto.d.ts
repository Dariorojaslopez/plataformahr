import { VacancyStatus } from '@prisma/client';
export declare class ListVacanciesQueryDto {
    status?: VacancyStatus;
    search?: string;
    page?: number;
    limit?: number;
}
export declare class UpdateVacancyDto {
    description?: string;
    status?: VacancyStatus;
}
