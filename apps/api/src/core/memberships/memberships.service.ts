import { Injectable } from '@nestjs/common';
import { Prisma, type CompanyMembership } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CompanyMembership | null> {
    return this.prisma.companyMembership.findUnique({ where: { id } });
  }

  findByUserAndCompany(
    userId: string,
    companyId: string,
  ): Promise<CompanyMembership | null> {
    return this.prisma.companyMembership.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });
  }

  listByUser(userId: string): Promise<CompanyMembership[]> {
    return this.prisma.companyMembership.findMany({ where: { userId } });
  }

  listByCompany(companyId: string): Promise<CompanyMembership[]> {
    return this.prisma.companyMembership.findMany({ where: { companyId } });
  }

  create(
    data: Prisma.CompanyMembershipCreateInput,
  ): Promise<CompanyMembership> {
    return this.prisma.companyMembership.create({ data });
  }
}
