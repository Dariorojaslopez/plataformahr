import { Prisma, type CompanyMembership } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export declare class MembershipsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findById(id: string): Promise<CompanyMembership | null>;
    findByUserAndCompany(userId: string, companyId: string): Promise<CompanyMembership | null>;
    listByUser(userId: string): Promise<CompanyMembership[]>;
    listByCompany(companyId: string): Promise<CompanyMembership[]>;
    create(data: Prisma.CompanyMembershipCreateInput): Promise<CompanyMembership>;
}
