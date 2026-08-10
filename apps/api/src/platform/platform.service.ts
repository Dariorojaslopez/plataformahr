import { Injectable } from '@nestjs/common';
import { CompanyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PlatformCompanyListItem = {
  id: string;
  name: string;
  slug: string;
};

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveCompanies(): Promise<PlatformCompanyListItem[]> {
    const companies = await this.prisma.company.findMany({
      where: {
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
    return companies;
  }
}
