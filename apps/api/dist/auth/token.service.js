"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const node_crypto_1 = require("node:crypto");
let TokenService = class TokenService {
    jwt;
    config;
    constructor(jwt, config) {
        this.jwt = jwt;
        this.config = config;
    }
    signAccessToken(userId, sessionId) {
        const payload = {
            sub: userId,
            sid: sessionId,
            type: 'access',
        };
        return this.jwt.sign(payload, {
            secret: this.accessSecret,
            expiresIn: this.accessTtlSeconds,
        });
    }
    signRefreshToken(userId, sessionId) {
        const payload = {
            sub: userId,
            sid: sessionId,
            type: 'refresh',
            jti: (0, node_crypto_1.randomUUID)(),
        };
        return this.jwt.sign(payload, {
            secret: this.refreshSecret,
            expiresIn: this.refreshTtlSeconds,
        });
    }
    verifyAccessToken(token) {
        const payload = this.jwt.verify(token, {
            secret: this.accessSecret,
        });
        if (payload.type !== 'access') {
            throw new Error('Invalid access token type');
        }
        return payload;
    }
    verifyRefreshToken(token) {
        const payload = this.jwt.verify(token, {
            secret: this.refreshSecret,
        });
        if (payload.type !== 'refresh' || !payload.jti) {
            throw new Error('Invalid refresh token type');
        }
        return payload;
    }
    get refreshTtlMs() {
        return this.refreshTtlSeconds * 1000;
    }
    get accessSecret() {
        return this.requireEnv('JWT_ACCESS_SECRET');
    }
    get refreshSecret() {
        return this.requireEnv('JWT_REFRESH_SECRET');
    }
    get accessTtlSeconds() {
        return this.parseTtlSeconds(this.config.get('JWT_ACCESS_TTL') ?? '15m');
    }
    get refreshTtlSeconds() {
        return this.parseTtlSeconds(this.config.get('JWT_REFRESH_TTL') ?? '7d');
    }
    requireEnv(key) {
        const value = this.config.get(key);
        if (!value) {
            throw new Error(`Missing required environment variable: ${key}`);
        }
        return value;
    }
    parseTtlSeconds(raw) {
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
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], TokenService);
//# sourceMappingURL=token.service.js.map