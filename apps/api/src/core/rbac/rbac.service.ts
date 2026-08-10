import { Injectable } from '@nestjs/common';
import {
  type MembershipRole,
  type Permission,
  Prisma,
  type Role,
  type RolePermission,
  RoleScope,
} from '@prisma/client';
import { PLATFORM_OWNER_TENANT_MEMBERSHIP } from '../../auth/auth.types';
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
    if (membershipId === PLATFORM_OWNER_TENANT_MEMBERSHIP) {
      return Promise.resolve([]);
    }
    return this.prisma.membershipRole.findMany({ where: { membershipId } });
  }

  async getPermissionCodesForMembership(
    membershipId: string,
  ): Promise<Set<string>> {
    if (membershipId === PLATFORM_OWNER_TENANT_MEMBERSHIP) {
      const permissions = await this.prisma.permission.findMany({
        select: { code: true },
      });
      return new Set(permissions.map((p) => p.code));
    }

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

  async getRoleCodesForMembership(membershipId: string): Promise<Set<string>> {
    if (membershipId === PLATFORM_OWNER_TENANT_MEMBERSHIP) {
      const roles = await this.prisma.role.findMany({
        where: { scope: RoleScope.COMPANY },
        select: { code: true },
      });
      return new Set(roles.map((r) => r.code));
    }

    const links = await this.prisma.membershipRole.findMany({
      where: { membershipId },
      include: { role: true },
    });
    return new Set(links.map((link) => link.role.code));
  }

  async membershipHasRoleCode(
    membershipId: string,
    roleCode: string,
  ): Promise<boolean> {
    const roles = await this.getRoleCodesForMembership(membershipId);
    return roles.has(roleCode);
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
