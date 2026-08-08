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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const audit_service_1 = require("../core/audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_types_1 = require("./auth.types");
const password_hashing_service_1 = require("./password-hashing.service");
const token_service_1 = require("./token.service");
let AuthService = class AuthService {
    prisma;
    passwordHashing;
    tokens;
    audit;
    constructor(prisma, passwordHashing, tokens, audit) {
        this.prisma = prisma;
        this.passwordHashing = passwordHashing;
        this.tokens = tokens;
        this.audit = audit;
    }
    async login(email, password, meta) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user ||
            user.deletedAt !== null ||
            user.status !== client_1.UserStatus.ACTIVE ||
            user.passwordHash === null) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordValid = await this.passwordHashing.verify(user.passwordHash, password);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const sessionId = (0, node_crypto_1.randomUUID)();
        const accessToken = this.tokens.signAccessToken(user.id, sessionId);
        const refreshToken = this.tokens.signRefreshToken(user.id, sessionId);
        const refreshTokenHash = await this.passwordHashing.hash(refreshToken);
        await this.prisma.userSession.create({
            data: {
                id: sessionId,
                userId: user.id,
                refreshTokenHash,
                expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
                ipAddress: meta?.ipAddress,
                userAgent: meta?.userAgent,
                lastUsedAt: new Date(),
            },
        });
        await this.audit.create({
            action: auth_types_1.AUTH_AUDIT.LOGIN_SUCCESS,
            entity: 'UserSession',
            entityId: sessionId,
            user: { connect: { id: user.id } },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
            metadata: { sessionId },
        });
        const companies = await this.listActiveCompaniesForUser(user.id);
        return {
            accessToken,
            refreshToken,
            user: this.toPublicUser(user),
            companies,
        };
    }
    async refresh(refreshToken, meta) {
        let payload;
        try {
            payload = this.tokens.verifyRefreshToken(refreshToken);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const session = await this.prisma.userSession.findUnique({
            where: { id: payload.sid },
        });
        if (!session ||
            session.userId !== payload.sub ||
            session.revokedAt !== null ||
            session.expiresAt.getTime() <= Date.now()) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const tokenMatches = await this.passwordHashing.verify(session.refreshTokenHash, refreshToken);
        if (!tokenMatches) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: session.userId },
        });
        if (!user || user.deletedAt !== null || user.status !== client_1.UserStatus.ACTIVE) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const newAccessToken = this.tokens.signAccessToken(user.id, session.id);
        const newRefreshToken = this.tokens.signRefreshToken(user.id, session.id);
        const refreshTokenHash = await this.passwordHashing.hash(newRefreshToken);
        await this.prisma.userSession.update({
            where: { id: session.id },
            data: {
                refreshTokenHash,
                lastUsedAt: new Date(),
                expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
                ipAddress: meta?.ipAddress ?? session.ipAddress,
                userAgent: meta?.userAgent ?? session.userAgent,
            },
        });
        await this.audit.create({
            action: auth_types_1.AUTH_AUDIT.REFRESH,
            entity: 'UserSession',
            entityId: session.id,
            user: { connect: { id: user.id } },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
            metadata: { sessionId: session.id },
        });
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }
    async logout(userId, sessionId, meta) {
        const session = await this.prisma.userSession.findUnique({
            where: { id: sessionId },
        });
        if (!session || session.userId !== userId) {
            throw new common_1.UnauthorizedException();
        }
        if (session.revokedAt === null) {
            await this.prisma.userSession.update({
                where: { id: sessionId },
                data: { revokedAt: new Date() },
            });
        }
        await this.audit.create({
            action: auth_types_1.AUTH_AUDIT.LOGOUT,
            entity: 'UserSession',
            entityId: sessionId,
            user: { connect: { id: userId } },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
            metadata: { sessionId },
        });
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.deletedAt !== null || user.status !== client_1.UserStatus.ACTIVE) {
            throw new common_1.UnauthorizedException();
        }
        const companies = await this.listActiveCompaniesForUser(user.id);
        return {
            ...this.toPublicUser(user),
            companies,
        };
    }
    async listActiveCompaniesForUser(userId) {
        const memberships = await this.prisma.companyMembership.findMany({
            where: {
                userId,
                status: client_1.MembershipStatus.ACTIVE,
                company: {
                    status: client_1.CompanyStatus.ACTIVE,
                    deletedAt: null,
                },
            },
            include: {
                company: true,
            },
            orderBy: {
                company: { name: 'asc' },
            },
        });
        return memberships.map((membership) => this.toPublicCompany(membership.company));
    }
    toPublicUser(user) {
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isPlatformOwner: user.isPlatformOwner,
        };
    }
    toPublicCompany(company) {
        return {
            id: company.id,
            name: company.name,
            slug: company.slug,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_hashing_service_1.PasswordHashingService,
        token_service_1.TokenService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map