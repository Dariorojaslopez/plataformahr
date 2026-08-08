import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_OWNER_ONLY_KEY } from '../decorators/platform-owner-only.decorator';

type RequestWithAuth = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_OWNER_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.userId },
    });

    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.ACTIVE ||
      !user.isPlatformOwner
    ) {
      throw new ForbiddenException('Platform owner access required');
    }

    return true;
  }
}
