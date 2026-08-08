import { type Candidate } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCandidateDto, ListCandidatesQueryDto, UpdateCandidateDto } from './dto/candidate.dto';
export declare class CandidatesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(companyId: string, query: ListCandidatesQueryDto): Promise<{
        items: {
            id: string;
            companyId: string;
            createdAt: Date;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.CandidateStatus;
            updatedAt: Date;
            deletedAt: Date | null;
            phone: string | null;
            country: string | null;
            state: string | null;
            city: string | null;
            documentType: string | null;
            documentNumber: string | null;
            source: string | null;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getById(companyId: string, id: string): Promise<Candidate>;
    create(companyId: string, userId: string, dto: CreateCandidateDto): Promise<Candidate>;
    update(companyId: string, userId: string, id: string, dto: UpdateCandidateDto): Promise<Candidate>;
}
