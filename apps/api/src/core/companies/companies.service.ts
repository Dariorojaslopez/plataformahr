import { Injectable } from '@nestjs/common';
import { Prisma, type Company } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { slug } });
  }

  create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async getEnabledAccess(companyId: string) {
    const [modules, features] = await Promise.all([
      this.prisma.companyModule.findMany({
        where: { companyId, enabled: true },
        select: { module: true },
      }),
      this.prisma.companyFeature.findMany({
        where: { companyId, enabled: true },
        select: { feature: true },
      }),
    ]);
    return {
      enabledModules: modules.map(({ module }) => module),
      enabledFeatures: features.map(({ feature }) => feature),
    };
  }
}
