import {
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../../auth/auth.types';

type RequestWithTenant = Request & {
  tenantContext?: TenantContext;
};

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    if (!request.tenantContext) {
      throw new ForbiddenException('Tenant context is required');
    }
    return request.tenantContext;
  },
);
