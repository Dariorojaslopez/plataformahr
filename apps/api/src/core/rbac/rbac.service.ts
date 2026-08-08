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

  async getPermissionCodesForMembership(
    membershipId: string,
  ): Promise<Set<string>> {
    const links = await this.prisma.membershipRole.findMany({
      where: { membershipId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const codes = new Set<string>();
    for (const link of links) {
      for (const rolePermission of link.role.permissions) {
        codes.add(rolePermission.permission.code);
      }
    }
    return codes;
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
