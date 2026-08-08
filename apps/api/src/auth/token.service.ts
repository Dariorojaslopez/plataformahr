import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(userId: string, sessionId: string): string {
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'access',
    };
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtlSeconds,
    });
  }

  signRefreshToken(userId: string, sessionId: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
      jti: randomUUID(),
    };
    return this.jwt.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtlSeconds,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const payload = this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.accessSecret,
    });
    if (payload.type !== 'access') {
      throw new Error('Invalid access token type');
    }
    return payload;
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    const payload = this.jwt.verify<RefreshTokenPayload>(token, {
      secret: this.refreshSecret,
    });
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new Error('Invalid refresh token type');
    }
    return payload;
  }

  get refreshTtlMs(): number {
    return this.refreshTtlSeconds * 1000;
  }

  private get accessSecret(): string {
    return this.requireEnv('JWT_ACCESS_SECRET');
  }

  private get refreshSecret(): string {
    return this.requireEnv('JWT_REFRESH_SECRET');
  }

  private get accessTtlSeconds(): number {
    return this.parseTtlSeconds(
      this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
  }

  private get refreshTtlSeconds(): number {
    return this.parseTtlSeconds(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    );
  }

  private requireEnv(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  private parseTtlSeconds(raw: string): number {
    const trimmed = raw.trim();
    const match = /^(\d+)([smhd])?$/.exec(trimmed);
    if (!match) {
      throw new Error(`Invalid TTL format: ${raw}`);
    }
    const amount = Number(match[1]);
    const unit = match[2] ?? 's';
    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 60 * 60 * 24;
      default:
        throw new Error(`Invalid TTL unit: ${raw}`);
    }
  }
}
