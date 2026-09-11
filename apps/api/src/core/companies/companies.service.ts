import { Injectable } from '@nestjs/common';
import { EmployeeStatus, Prisma, type Company } from '@prisma/client';
import {
  ROLE_MENU_CATALOG,
  resolveAllowedNavHrefs,
  resolveCompanyHomeRole,
  type CompanyHomeRole,
} from '@talento/shared';
import type { TenantContext } from '../../auth/auth.types';
import { ORG_CHART_EMPLOYEE_SELECT } from '../../organization/org-chart/org-chart.service';
import { listOrgChartReports } from '../../organization/org-chart/org-chart.tree';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { RoleMenuService } from './role-menu/role-menu.service';

export type CompanyEnabledAccess = {
  enabledModules: string[];
  enabledFeatures: string[];
};

export type CurrentCompanyAccessContext = CompanyEnabledAccess & {
  roleCodes: string[];
  hasDirectReports: boolean;
  homeRole: CompanyHomeRole;
  allowedNavHrefs: string[];
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly roleMenus: RoleMenuService,
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
    const [access, roleCodeSet, hasDirectReports, overrides] =
      await Promise.all([
        this.getEnabledAccess(tenant.companyId),
        this.rbac.getRoleCodesForMembership(tenant.membershipId),
        this.hasDirectReports(tenant),
        this.roleMenus.listOverrides(tenant.companyId),
      ]);
    const roleCodes = [...roleCodeSet].sort();
    const homeRole = resolveCompanyHomeRole(roleCodes, hasDirectReports);
    return {
      ...access,
      roleCodes,
      hasDirectReports,
      homeRole,
      allowedNavHrefs: resolveAllowedNavHrefs({
        roleCodes,
        homeRole,
        catalogHrefs: ROLE_MENU_CATALOG.map((item) => item.href),
        overrides,
      }),
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

    const rows = await this.prisma.employee.findMany({
      where: {
        companyId: tenant.companyId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: ORG_CHART_EMPLOYEE_SELECT,
    });
    return listOrgChartReports(rows, employee.id).length > 0;
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
      vacancyHiringSlaDays: company.vacancyHiringSlaDays,
      atsThankYouLetterSubject: company.atsThankYouLetterSubject,
      atsThankYouLetterBody: company.atsThankYouLetterBody,
      offerLetterTemplateOriginalName: company.offerLetterTemplateOriginalName,
      contractTemplateOriginalName: company.contractTemplateOriginalName,
      hasOfferLetterTemplate: Boolean(company.offerLetterTemplateFileName),
      hasContractTemplate: Boolean(company.contractTemplateFileName),
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

  async updateAtsSettings(
    companyId: string,
    data: {
      vacancyHiringSlaDays?: number;
      atsThankYouLetterSubject?: string | null;
      atsThankYouLetterBody?: string | null;
    },
  ) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(data.vacancyHiringSlaDays !== undefined
          ? { vacancyHiringSlaDays: data.vacancyHiringSlaDays }
          : {}),
        ...(data.atsThankYouLetterSubject !== undefined
          ? {
              atsThankYouLetterSubject:
                data.atsThankYouLetterSubject?.trim() || null,
            }
          : {}),
        ...(data.atsThankYouLetterBody !== undefined
          ? {
              atsThankYouLetterBody: data.atsThankYouLetterBody?.trim() || null,
            }
          : {}),
      },
    });
    return this.toCurrentResponse(company);
  }
}
