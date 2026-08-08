import { Injectable } from '@nestjs/common';
import {
  type MembershipRole,
  type Permission,
  Prisma,
  type Role,
  type RolePermission,
  RoleScope,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  findRoleByScopeAndCode(scope: RoleScope, code: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { scope_code: { scope, code } },
    });
  }

  findPermissionByCode(code: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { code } });
  }

  listRolesForMembership(membershipId: string): Promise<MembershipRole[]> {
    return this.prisma.membershipRole.findMany({ where: { membershipId } });
  }

  assignRoleToMembership(
    membershipId: string,
    roleId: string,
  ): Promise<MembershipRole> {
    return this.prisma.membershipRole.create({
      data: { membershipId, roleId },
    });
  }

  grantPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission> {
    return this.prisma.rolePermission.create({
      data: { roleId, permissionId },
    });
  }

  createRole(data: Prisma.RoleCreateInput): Promise<Role> {
    return this.prisma.role.create({ data });
  }
}
