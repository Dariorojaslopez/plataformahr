import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyStatus, MembershipStatus, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import {
  COMPANY_ID_HEADER,
  type AuthenticatedUser,
  type TenantContext,
} from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

type RequestWithAuth = Request & {
  user?: AuthenticatedUser;
  tenantContext?: TenantContext;
};

@Injectable()
export class CompanyContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const headerValue = request.headers[COMPANY_ID_HEADER];
    const companyId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!companyId || typeof companyId !== 'string') {
      throw new ForbiddenException('X-Company-Id header is required');
    }

    const membership = await this.prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: user.userId,
          companyId,
        },
      },
      include: {
        company: true,
        user: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Invalid company membership');
    }

    if (
      membership.user.deletedAt !== null ||
      membership.user.status !== UserStatus.ACTIVE
    ) {
      throw new ForbiddenException('Invalid company membership');
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('Membership is not active');
    }

    if (
      membership.company.deletedAt !== null ||
      membership.company.status !== CompanyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Company is not available');
    }

    request.tenantContext = {
      userId: user.userId,
      companyId: membership.companyId,
      membershipId: membership.id,
    };

    return true;
  }
}
