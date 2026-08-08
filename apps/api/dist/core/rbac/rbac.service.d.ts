import { type MembershipRole, type Permission, Prisma, type Role, type RolePermission, RoleScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export declare class RbacService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findRoleByScopeAndCode(scope: RoleScope, code: string): Promise<Role | null>;
    findPermissionByCode(code: string): Promise<Permission | null>;
    listRolesForMembership(membershipId: string): Promise<MembershipRole[]>;
    assignRoleToMembership(membershipId: string, roleId: string): Promise<MembershipRole>;
    grantPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission>;
    createRole(data: Prisma.RoleCreateInput): Promise<Role>;
}
