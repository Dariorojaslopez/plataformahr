import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types';
export declare class TokenService {
    private readonly jwt;
    private readonly config;
    constructor(jwt: JwtService, config: ConfigService);
    signAccessToken(userId: string, sessionId: string): string;
    signRefreshToken(userId: string, sessionId: string): string;
    verifyAccessToken(token: string): AccessTokenPayload;
    verifyRefreshToken(token: string): RefreshTokenPayload;
    get refreshTtlMs(): number;
    private get accessSecret();
    private get refreshSecret();
    private get accessTtlSeconds();
    private get refreshTtlSeconds();
    private requireEnv;
    private parseTtlSeconds;
}
