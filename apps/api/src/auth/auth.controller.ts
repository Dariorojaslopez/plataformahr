import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from '../config/refresh-cookie';
import { SECURITY_CONFIG } from '../config/security.constants';
import type { SecurityRuntimeConfig } from '../config/security.config';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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
  constructor(
    private readonly authService: AuthService,
    @Inject(SECURITY_CONFIG)
    private readonly security: SecurityRuntimeConfig,
  ) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
      requestMeta(req),
    );
    setRefreshCookie(res, result.refreshToken, this.security);
    res.setHeader('Cache-Control', 'no-store');
    return {
      accessToken: result.accessToken,
      user: result.user,
      companies: result.companies,
    };
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshCookie(
      req.cookies as Record<string, string> | undefined,
    );
    const result = await this.authService.refresh(
      refreshToken,
      requestMeta(req),
    );
    setRefreshCookie(res, result.refreshToken, this.security);
    res.setHeader('Cache-Control', 'no-store');
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(
      user.userId,
      user.sessionId,
      requestMeta(req),
    );
    clearRefreshCookie(res, this.security);
    res.setHeader('Cache-Control', 'no-store');
    return { success: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(
      user.userId,
      user.sessionId,
      body.currentPassword,
      body.newPassword,
      requestMeta(req),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.authService.getMe(user.userId);
  }
}
