import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';

function requestMeta(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  const userAgentHeader = req.headers['user-agent'];
  return {
    ipAddress: req.ip,
    userAgent:
      typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(body.email, body.password, requestMeta(req));
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() body: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(body.refreshToken, requestMeta(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.authService.logout(
      user.userId,
      user.sessionId,
      requestMeta(req),
    );
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }
}
