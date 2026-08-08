import type { Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: LoginDto, req: Request): Promise<import("./auth.service").AuthTokensResponse>;
    refresh(body: RefreshDto, req: Request): Promise<import("./auth.service").TokensOnlyResponse>;
    logout(user: AuthenticatedUser, req: Request): Promise<{
        success: boolean;
    }>;
    me(user: AuthenticatedUser): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isPlatformOwner: boolean;
        companies: import("./auth.service").PublicCompany[];
    }>;
}
