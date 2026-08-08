import { Prisma, type Company } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export declare class CompaniesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findById(id: string): Promise<Company | null>;
    findBySlug(slug: string): Promise<Company | null>;
    create(data: Prisma.CompanyCreateInput): Promise<Company>;
}
