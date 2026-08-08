import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CreateJobLevelDto, UpdateJobLevelDto } from './dto/job-level.dto';
import { JobLevelsService } from './job-levels.service';
export declare class JobLevelsController {
    private readonly jobLevelsService;
    constructor(jobLevelsService: JobLevelsService);
    list(tenant: TenantContext): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        rank: number;
    }[]>;
    create(tenant: TenantContext, user: AuthenticatedUser, dto: CreateJobLevelDto): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        rank: number;
    }>;
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateJobLevelDto): Promise<{
        name: string;
        id: string;
        companyId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.OrganizationEntityStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        code: string | null;
        rank: number;
    }>;
}
