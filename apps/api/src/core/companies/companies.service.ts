import { Injectable } from '@nestjs/common';
import {
  EmployeeStatus,
  Prisma,
  ReportingLineType,
  type Company,
} from '@prisma/client';
import {
  resolveCompanyHomeRole,
  type CompanyHomeRole,
} from '@talento/shared';
import type { TenantContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

export type CompanyEnabledAccess = {
  enabledModules: string[];
  enabledFeatures: string[];
};

export type CurrentCompanyAccessContext = CompanyEnabledAccess & {
  roleCodes: string[];
  hasDirectReports: boolean;
  homeRole: CompanyHomeRole;
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { slug } });
  }

  create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async getEnabledAccess(companyId: string): Promise<CompanyEnabledAccess> {
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

  async getCurrentAccessContext(
    tenant: TenantContext,
  ): Promise<CurrentCompanyAccessContext> {
    const [access, roleCodeSet, hasDirectReports] = await Promise.all([
      this.getEnabledAccess(tenant.companyId),
      this.rbac.getRoleCodesForMembership(tenant.membershipId),
      this.hasDirectReports(tenant),
    ]);
    const roleCodes = [...roleCodeSet].sort();
    return {
      ...access,
      roleCodes,
      hasDirectReports,
      homeRole: resolveCompanyHomeRole(roleCodes, hasDirectReports),
    };
  }

  private async hasDirectReports(tenant: TenantContext): Promise<boolean> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId: tenant.companyId,
        userId: tenant.userId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!employee) return false;

    const count = await this.prisma.employeeReportingLine.count({
      where: {
        companyId: tenant.companyId,
        managerEmployeeId: employee.id,
        type: ReportingLineType.DIRECT,
        employee: {
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
      },
    });
    return count > 0;
  }

  toCurrentResponse(company: Company) {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      defaultLanguage: company.defaultLanguage,
      goalsCascadeEnabled: company.goalsCascadeEnabled,
      showNineBoxOnMyResults: company.showNineBoxOnMyResults,
    };
  }

  async updatePerformanceSettings(
    companyId: string,
    data: {
      goalsCascadeEnabled?: boolean;
      showNineBoxOnMyResults?: boolean;
    },
  ) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(data.goalsCascadeEnabled !== undefined
          ? { goalsCascadeEnabled: data.goalsCascadeEnabled }
          : {}),
        ...(data.showNineBoxOnMyResults !== undefined
          ? { showNineBoxOnMyResults: data.showNineBoxOnMyResults }
          : {}),
      },
    });
    return this.toCurrentResponse(company);
  }
}
