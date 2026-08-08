import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  CompanyStatus,
  MembershipStatus,
  UserStatus,
  type Company,
  type User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../core/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_AUDIT } from './auth.types';
import { PasswordHashingService } from './password-hashing.service';
import { TokenService } from './token.service';

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformOwner: boolean;
};

export type PublicCompany = {
  id: string;
  name: string;
  slug: string;
};

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  companies: PublicCompany[];
};

export type TokensOnlyResponse = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashing: PasswordHashingService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokensResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.ACTIVE ||
      user.passwordHash === null
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.passwordHashing.verify(
      user.passwordHash,
      password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sessionId = randomUUID();
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
      action: AUTH_AUDIT.LOGIN_SUCCESS,
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

  async refresh(
    refreshToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<TokensOnlyResponse> {
    let payload;
    try {
      payload = this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await this.passwordHashing.verify(
      session.refreshTokenHash,
      refreshToken,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
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
      action: AUTH_AUDIT.REFRESH,
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

  async logout(
    userId: string,
    sessionId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException();
    }

    if (session.revokedAt === null) {
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.create({
      action: AUTH_AUDIT.LOGOUT,
      entity: 'UserSession',
      entityId: sessionId,
      user: { connect: { id: userId } },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { sessionId },
    });
  }

  async getMe(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isPlatformOwner: boolean;
    companies: PublicCompany[];
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }

    const companies = await this.listActiveCompaniesForUser(user.id);
    return {
      ...this.toPublicUser(user),
      companies,
    };
  }

  private async listActiveCompaniesForUser(
    userId: string,
  ): Promise<PublicCompany[]> {
    const memberships = await this.prisma.companyMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        company: {
          status: CompanyStatus.ACTIVE,
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

    return memberships.map((membership) =>
      this.toPublicCompany(membership.company),
    );
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformOwner: user.isPlatformOwner,
    };
  }

  private toPublicCompany(company: Company): PublicCompany {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
    };
  }
}
