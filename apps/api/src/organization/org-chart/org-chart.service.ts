import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus, ReportingLineType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildOrgChartForest } from './org-chart.tree';

export const ORG_CHART_EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  status: true,
  businessUnit: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  position: {
    select: {
      id: true,
      name: true,
      jobLevel: { select: { id: true, name: true, rank: true } },
    },
  },
  reportingTo: {
    where: { type: ReportingLineType.DIRECT },
    select: { managerEmployeeId: true },
    take: 1,
  },
} as const;

@Injectable()
export class OrgChartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string, includeInactive = false) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { status: EmployeeStatus.ACTIVE }),
      },
      select: ORG_CHART_EMPLOYEE_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const roots = buildOrgChartForest(employees);
    return {
      company,
      generatedAt: new Date().toISOString(),
      includeInactive,
      employeeCount: employees.length,
      rootCount: roots.length,
      roots,
    };
  }
}
