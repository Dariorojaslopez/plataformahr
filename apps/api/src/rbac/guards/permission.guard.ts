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
import { RbacService } from '../../core/rbac/rbac.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

type RequestWithAuth = Request & {
  user?: AuthenticatedUser;
  tenantContext?: TenantContext;
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
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

    const granted = await this.rbac.getPermissionCodesForMembership(
      request.tenantContext.membershipId,
    );

    const missing = required.filter((code) => !granted.has(code));
    if (missing.length > 0) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
