import {
  PrismaClient,
  RoleScope,
  type Permission,
  type Role,
} from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_ROLES = [
  {
    code: 'COLLABORATOR',
    name: 'Collaborator',
    description: 'Standard company collaborator',
  },
  {
    code: 'LEADER',
    name: 'Leader',
    description: 'Team or area leader',
  },
  {
    code: 'RECRUITER',
    name: 'Recruiter',
    description: 'Recruitment operator',
  },
  {
    code: 'PERFORMANCE_MANAGER',
    name: 'Performance Manager',
    description: 'Performance process manager',
  },
  {
    code: 'CLIENT_ADMIN',
    name: 'Client Admin',
    description: 'Company administrator',
  },
] as const;

const PERMISSIONS = [
  {
    code: 'company.read',
    name: 'Read company',
    description: 'View company information',
  },
  {
    code: 'company.manage',
    name: 'Manage company',
    description: 'Create and update company settings',
  },
  {
    code: 'users.read',
    name: 'Read users',
    description: 'View company users and memberships',
  },
  {
    code: 'users.manage',
    name: 'Manage users',
    description: 'Invite and manage company users',
  },
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  CLIENT_ADMIN: [
    'company.read',
    'company.manage',
    'users.read',
    'users.manage',
  ],
  RECRUITER: ['company.read'],
  PERFORMANCE_MANAGER: ['company.read'],
  LEADER: ['company.read'],
  COLLABORATOR: ['company.read'],
};

async function upsertCompanyRoles(): Promise<Map<string, Role>> {
  const rolesByCode = new Map<string, Role>();

  for (const role of COMPANY_ROLES) {
    const saved = await prisma.role.upsert({
      where: {
        scope_code: {
          scope: RoleScope.COMPANY,
          code: role.code,
        },
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        scope: RoleScope.COMPANY,
        isSystem: true,
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
    rolesByCode.set(role.code, saved);
  }

  return rolesByCode;
}

async function upsertPermissions(): Promise<Map<string, Permission>> {
  const permissionsByCode = new Map<string, Permission>();

  for (const permission of PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
    });
    permissionsByCode.set(permission.code, saved);
  }

  return permissionsByCode;
}

async function syncRolePermissions(
  rolesByCode: Map<string, Role>,
  permissionsByCode: Map<string, Permission>,
): Promise<void> {
  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = rolesByCode.get(roleCode);
    if (!role) {
      throw new Error(`Missing seeded role: ${roleCode}`);
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissionsByCode.get(permissionCode);
      if (!permission) {
        throw new Error(`Missing seeded permission: ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
        update: {},
      });
    }
  }
}

async function main(): Promise<void> {
  const rolesByCode = await upsertCompanyRoles();
  const permissionsByCode = await upsertPermissions();
  await syncRolePermissions(rolesByCode, permissionsByCode);

  console.log(
    `Seed completed: ${rolesByCode.size} company roles, ${permissionsByCode.size} permissions`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
