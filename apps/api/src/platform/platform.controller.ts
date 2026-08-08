import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from '../core/users/users.service';
import { PlatformOwnerOnly } from './decorators/platform-owner-only.decorator';
import { PlatformOwnerGuard } from './guards/platform-owner.guard';

@Controller('platform')
export class PlatformController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @PlatformOwnerOnly()
  async me(@CurrentUser() authUser: AuthenticatedUser) {
    const user = await this.usersService.findById(authUser.userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformOwner: user.isPlatformOwner,
    };
  }
}
