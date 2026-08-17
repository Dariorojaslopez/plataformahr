import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { isObservable, lastValueFrom } from 'rxjs';
import type { AuthenticatedUser } from '../auth.types';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard extends AuthGuard('access-jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);
    const allowed = isObservable(result)
      ? await lastValueFrom(result)
      : await result;
    if (!allowed) return false;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      request.user?.mustChangePassword &&
      !['/auth/change-password', '/auth/logout', '/auth/me'].includes(
        request.path,
      )
    ) {
      throw new ForbiddenException('Password change required');
    }
    return true;
  }
}
