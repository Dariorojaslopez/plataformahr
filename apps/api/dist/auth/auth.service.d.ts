import { AuditService } from '../core/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
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
export declare class AuthService {
    private readonly prisma;
    private readonly passwordHashing;
    private readonly tokens;
    private readonly audit;
    constructor(prisma: PrismaService, passwordHashing: PasswordHashingService, tokens: TokenService, audit: AuditService);
    login(email: string, password: string, meta?: {
        ipAddress?: string;
        userAgent?: string;
    }): Promise<AuthTokensResponse>;
    refresh(refreshToken: string, meta?: {
        ipAddress?: string;
        userAgent?: string;
    }): Promise<TokensOnlyResponse>;
    logout(userId: string, sessionId: string, meta?: {
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;
    getMe(userId: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isPlatformOwner: boolean;
        companies: PublicCompany[];
    }>;
    private listActiveCompaniesForUser;
    private toPublicUser;
    private toPublicCompany;
}
