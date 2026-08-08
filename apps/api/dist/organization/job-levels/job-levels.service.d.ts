import { type JobLevel } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateJobLevelDto, UpdateJobLevelDto } from './dto/job-level.dto';
export declare class JobLevelsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(companyId: string): Promise<JobLevel[]>;
    create(companyId: string, userId: string, dto: CreateJobLevelDto): Promise<JobLevel>;
    update(companyId: string, userId: string, id: string, dto: UpdateJobLevelDto): Promise<JobLevel>;
}
