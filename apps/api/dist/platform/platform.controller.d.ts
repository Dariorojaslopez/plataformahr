import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from '../core/users/users.service';
export declare class PlatformController {
    private readonly usersService;
    constructor(usersService: UsersService);
    me(authUser: AuthenticatedUser): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isPlatformOwner: boolean;
    } | null>;
}
