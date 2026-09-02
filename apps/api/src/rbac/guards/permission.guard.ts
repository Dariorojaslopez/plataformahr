import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { REQUIRED_COMPANY_FEATURES_KEY } from '../decorators/require-company-features.decorator';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { CompanyFeatureCode, CompanyModuleCode } from '@talento/shared';

type RequestWithAuth = Request & {
  user?: AuthenticatedUser;
  tenantContext?: TenantContext;
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (!request.tenantContext) {
      throw new ForbiddenException('Tenant context is required');
    }

    const pathAccess = this.accessForPath(request.originalUrl.split('?')[0]);
    const module = pathAccess.module ?? this.moduleForPermissions(required);
    const features =
      this.reflector.getAllAndOverride<CompanyFeatureCode[]>(
        REQUIRED_COMPANY_FEATURES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? pathAccess.features;
    if (module) {
      const configuredModules = await this.prisma.companyModule.findMany({
        where: { companyId: request.tenantContext.companyId },
        select: { module: true, enabled: true },
      });
      // Legacy/test tenants without configuration retain the historical access.
      if (
        configuredModules.length > 0 &&
        !configuredModules.some(
          (item) => item.module === module && item.enabled,
        )
      ) {
        throw new ForbiddenException('Module is not enabled for this company');
      }
      if (features?.length) {
        const enabledFeature = await this.prisma.companyFeature.count({
          where: {
            companyId: request.tenantContext.companyId,
            feature: { in: features },
            enabled: true,
          },
        });
        if (configuredModules.length > 0 && enabledFeature === 0) {
          throw new ForbiddenException(
            'Feature is not enabled for this company',
          );
        }
      }
    }

    const granted = await this.rbac.getPermissionCodesForMembership(
      request.tenantContext.membershipId,
    );

    const missing = required.filter((code) => !granted.has(code));
    if (missing.length > 0) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }

  private moduleForPermissions(
    permissions: string[],
  ): CompanyModuleCode | null {
    if (permissions.some((code) => code.startsWith('organization.')))
      return 'ORGANIZATION';
    if (permissions.some((code) => code.startsWith('ats.'))) return 'ATS';
    if (permissions.some((code) => code.startsWith('performance.')))
      return 'PERFORMANCE';
    if (permissions.some((code) => code.startsWith('goals.'))) return 'GOALS';
    return null;
  }

  private accessForPath(path: string): {
    module: CompanyModuleCode | null;
    features: CompanyFeatureCode[];
  } {
    const mappings: Array<{
      prefix: string;
      module: CompanyModuleCode;
      features: CompanyFeatureCode[];
    }> = [
      {
        prefix: '/organization/position-custom-fields',
        module: 'ORGANIZATION',
        features: ['organization.position-fields'],
      },
      {
        prefix: '/organization/business-units',
        module: 'ORGANIZATION',
        features: ['organization.business-units'],
      },
      {
        prefix: '/organization/job-levels',
        module: 'ORGANIZATION',
        features: ['organization.job-levels'],
      },
      {
        prefix: '/organization/employees',
        module: 'ORGANIZATION',
        features: ['organization.employees'],
      },
      {
        prefix: '/organization/org-chart',
        module: 'ORGANIZATION',
        features: ['organization.org-chart'],
      },
      {
        prefix: '/organization/import',
        module: 'ORGANIZATION',
        features: ['organization.import'],
      },
      {
        prefix: '/organization/positions',
        module: 'ORGANIZATION',
        features: ['organization.positions'],
      },
      {
        prefix: '/organization/areas',
        module: 'ORGANIZATION',
        features: ['organization.areas'],
      },
      {
        prefix: '/ats/vacancy-approval-workflow',
        module: 'ATS',
        features: ['ats.approvals', 'ats.vacancy-requests'],
      },
      {
        prefix: '/ats/evaluator-defaults',
        module: 'ATS',
        features: ['ats.approvals'],
      },
      {
        prefix: '/ats/active-processes',
        module: 'ATS',
        features: ['ats.approvals'],
      },
      {
        prefix: '/ats/position-occupants',
        module: 'ATS',
        features: ['ats.approvals', 'ats.vacancy-requests'],
      },
      {
        prefix: '/ats/vacancy-requests',
        module: 'ATS',
        features: ['ats.vacancy-requests'],
      },
      {
        prefix: '/ats/interview-form-templates',
        module: 'ATS',
        features: ['ats.interview-templates'],
      },
      {
        prefix: '/ats/interviews',
        module: 'ATS',
        features: ['ats.interviews'],
      },
      {
        prefix: '/ats/candidates',
        module: 'ATS',
        features: ['ats.candidates'],
      },
      {
        prefix: '/ats/applications',
        module: 'ATS',
        features: ['ats.candidates', 'ats.pipeline', 'ats.interviews'],
      },
      {
        prefix: '/ats/vacancies',
        module: 'ATS',
        features: ['ats.vacancies', 'ats.pipeline'],
      },
      {
        prefix: '/performance/competencies',
        module: 'PERFORMANCE',
        features: ['performance.competencies'],
      },
      {
        prefix: '/performance/scales',
        module: 'PERFORMANCE',
        features: ['performance.scales'],
      },
      {
        prefix: '/performance/cycles',
        module: 'PERFORMANCE',
        features: ['performance.cycles'],
      },
      {
        prefix: '/performance/calibration',
        module: 'PERFORMANCE',
        features: ['performance.calibration', 'performance.my-results'],
      },
      {
        prefix: '/performance/9box',
        module: 'PERFORMANCE',
        features: ['performance.calibration', 'performance.my-results'],
      },
      {
        prefix: '/performance/evaluations',
        module: 'PERFORMANCE',
        features: ['performance.cycles', 'performance.my-evaluations'],
      },
      {
        prefix: '/performance/my-evaluations',
        module: 'PERFORMANCE',
        features: ['performance.my-evaluations'],
      },
      {
        prefix: '/performance',
        module: 'PERFORMANCE',
        features: [
          'performance.results',
          'performance.my-results',
          'performance.my-evaluations',
          'performance.population',
          'performance.calibration',
        ],
      },
      {
        prefix: '/goals/cycles',
        module: 'GOALS',
        features: ['goals.cycles'],
      },
      {
        prefix: '/goals',
        module: 'GOALS',
        features: ['goals.goals', 'goals.mine', 'goals.team', 'goals.reviews'],
      },
      {
        prefix: '/companies/current/branding',
        module: 'SETTINGS',
        features: ['settings.branding'],
      },
    ];
    const match = mappings.find(
      ({ prefix }) => path === prefix || path.startsWith(`${prefix}/`),
    );
    return match ?? { module: null, features: [] };
  }
}
