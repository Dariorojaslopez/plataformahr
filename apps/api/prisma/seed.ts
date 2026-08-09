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
  {
    code: 'organization.read',
    name: 'Read organization',
    description: 'View organizational structure and employees',
  },
  {
    code: 'organization.manage',
    name: 'Manage organization',
    description: 'Create and update organizational structure and employees',
  },
  {
    code: 'ats.vacancy.read',
    name: 'Read vacancies',
    description: 'View vacancy requests and vacancies',
  },
  {
    code: 'ats.vacancy.request',
    name: 'Request vacancies',
    description: 'Create and submit vacancy requests',
  },
  {
    code: 'ats.vacancy.approve',
    name: 'Approve vacancies',
    description: 'Approve or reject vacancy request steps',
  },
  {
    code: 'ats.vacancy.manage',
    name: 'Manage vacancies',
    description: 'Manage vacancy status and details',
  },
  {
    code: 'ats.candidate.read',
    name: 'Read candidates',
    description: 'View candidates',
  },
  {
    code: 'ats.candidate.manage',
    name: 'Manage candidates',
    description: 'Create and update candidates',
  },
  {
    code: 'ats.application.read',
    name: 'Read applications',
    description: 'View applications and pipeline',
  },
  {
    code: 'ats.application.manage',
    name: 'Manage applications',
    description: 'Create applications and move pipeline stages',
  },
  {
    code: 'ats.interview.read',
    name: 'Read interviews',
    description: 'View interviews, templates and transcripts',
  },
  {
    code: 'ats.interview.manage',
    name: 'Manage interviews',
    description: 'Create and update interviews and form templates',
  },
  {
    code: 'ats.interview.evaluate',
    name: 'Evaluate interviews',
    description: 'Answer interview evaluation questions',
  },
  {
    code: 'ats.interview.transcribe',
    name: 'Transcribe interviews',
    description: 'Create and edit textual interview transcripts',
  },
  {
    code: 'ats.offer.read',
    name: 'Read job offers',
    description: 'View job offers for applications',
  },
  {
    code: 'ats.offer.manage',
    name: 'Manage job offers',
    description: 'Create, update, send and withdraw job offers',
  },
  {
    code: 'ats.offer.respond',
    name: 'Respond to job offers',
    description:
      'Administratively register candidate acceptance or rejection of offers',
  },
  {
    code: 'ats.hiring.read',
    name: 'Read hirings',
    description: 'View formal hiring records',
  },
  {
    code: 'ats.hiring.manage',
    name: 'Manage hirings',
    description: 'Execute formal hiring from accepted offers',
  },
  {
    code: 'performance.cycle.read',
    name: 'Read performance cycles',
    description: 'View performance cycles and their competency configuration',
  },
  {
    code: 'performance.cycle.manage',
    name: 'Manage performance cycles',
    description: 'Create, update and transition performance cycles',
  },
  {
    code: 'performance.competency.read',
    name: 'Read competencies',
    description: 'View company competency catalog',
  },
  {
    code: 'performance.competency.manage',
    name: 'Manage competencies',
    description: 'Create and update company competencies',
  },
  {
    code: 'performance.scale.read',
    name: 'Read competency scales',
    description: 'View competency scales and levels',
  },
  {
    code: 'performance.scale.manage',
    name: 'Manage competency scales',
    description: 'Create and update competency scales and levels',
  },
  {
    code: 'performance.evaluation.read',
    name: 'Read performance evaluations',
    description: 'View own or administered performance evaluations',
  },
  {
    code: 'performance.evaluation.manage',
    name: 'Manage performance evaluations',
    description: 'Assign cycle participants and administer evaluations',
  },
  {
    code: 'performance.evaluation.respond',
    name: 'Respond to performance evaluations',
    description: 'Respond to assigned self or manager evaluations',
  },
  {
    code: 'performance.result.read',
    name: 'Read performance results',
    description: 'View consolidated performance results administratively',
  },
  {
    code: 'performance.result.manage',
    name: 'Manage performance results',
    description: 'Calculate consolidated performance results',
  },
  {
    code: 'performance.result.release',
    name: 'Release performance results',
    description: 'Publish calculated results to employees',
  },
  {
    code: 'performance.analytics.read',
    name: 'Read performance analytics',
    description:
      'View cycle analytics dashboards, organizational breakdowns, and CSV exports',
  },
  {
    code: 'goals.cycle.read',
    name: 'Read goal cycles',
    description: 'View goal periods',
  },
  {
    code: 'goals.cycle.manage',
    name: 'Manage goal cycles',
    description: 'Create, update and transition goal periods',
  },
  {
    code: 'goals.goal.read',
    name: 'Read goals',
    description: 'View own applicable goals (mine) and cycle metadata',
  },
  {
    code: 'goals.goal.manage',
    name: 'Manage goals',
    description: 'Create, update, activate and cancel goals administratively',
  },
  {
    code: 'goals.goal.assign',
    name: 'Assign goals',
    description: 'Add or remove goal assignments to employees',
  },
  {
    code: 'goals.progress.update',
    name: 'Update goal progress',
    description:
      'Register key-result check-ins (resource-scoped for collaborators; tenant-wide with goal.manage)',
  },
  {
    code: 'goals.completion.request',
    name: 'Request goal completion',
    description:
      'Request formal goal close (resource-scoped for collaborators; tenant-wide with goal.manage)',
  },
  {
    code: 'goals.completion.review',
    name: 'Review goal completion',
    description:
      'Approve or reject goal completion requests (admin/PM tenant-wide; leaders DIRECT individual only)',
  },
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  CLIENT_ADMIN: [
    'company.read',
    'company.manage',
    'users.read',
    'users.manage',
    'organization.read',
    'organization.manage',
    'ats.vacancy.read',
    'ats.vacancy.request',
    'ats.vacancy.approve',
    'ats.vacancy.manage',
    'ats.candidate.read',
    'ats.candidate.manage',
    'ats.application.read',
    'ats.application.manage',
    'ats.interview.read',
    'ats.interview.manage',
    'ats.interview.evaluate',
    'ats.interview.transcribe',
    'ats.offer.read',
    'ats.offer.manage',
    'ats.offer.respond',
    'ats.hiring.read',
    'ats.hiring.manage',
    'performance.cycle.read',
    'performance.cycle.manage',
    'performance.competency.read',
    'performance.competency.manage',
    'performance.scale.read',
    'performance.scale.manage',
    'performance.evaluation.read',
    'performance.evaluation.manage',
    'performance.evaluation.respond',
    'performance.result.read',
    'performance.result.manage',
    'performance.result.release',
    'performance.analytics.read',
    'goals.cycle.read',
    'goals.cycle.manage',
    'goals.goal.read',
    'goals.goal.manage',
    'goals.goal.assign',
    'goals.progress.update',
    'goals.completion.request',
    'goals.completion.review',
  ],
  RECRUITER: [
    'company.read',
    'organization.read',
    'ats.vacancy.read',
    'ats.vacancy.request',
    'ats.vacancy.manage',
    'ats.candidate.read',
    'ats.candidate.manage',
    'ats.application.read',
    'ats.application.manage',
    'ats.interview.read',
    'ats.interview.manage',
    'ats.interview.evaluate',
    'ats.interview.transcribe',
    'ats.offer.read',
    'ats.offer.manage',
    'ats.offer.respond',
    'ats.hiring.read',
    'ats.hiring.manage',
  ],
  PERFORMANCE_MANAGER: [
    'company.read',
    'organization.read',
    'ats.vacancy.read',
    'performance.cycle.read',
    'performance.cycle.manage',
    'performance.competency.read',
    'performance.competency.manage',
    'performance.scale.read',
    'performance.scale.manage',
    'performance.evaluation.read',
    'performance.evaluation.manage',
    'performance.evaluation.respond',
    'performance.result.read',
    'performance.result.manage',
    'performance.result.release',
    'performance.analytics.read',
    'goals.cycle.read',
    'goals.cycle.manage',
    'goals.goal.read',
    'goals.goal.manage',
    'goals.goal.assign',
    'goals.progress.update',
    'goals.completion.request',
    'goals.completion.review',
  ],
  LEADER: [
    'company.read',
    'organization.read',
    'ats.vacancy.read',
    'ats.vacancy.request',
    'ats.vacancy.approve',
    'ats.candidate.read',
    'ats.application.read',
    'ats.interview.read',
    'ats.interview.evaluate',
    'ats.interview.transcribe',
    'ats.offer.read',
    'ats.hiring.read',
    'performance.cycle.read',
    'performance.competency.read',
    'performance.scale.read',
    'performance.evaluation.read',
    'performance.evaluation.respond',
    'goals.cycle.read',
    'goals.goal.read',
    'goals.completion.review',
  ],
  COLLABORATOR: [
    'company.read',
    'organization.read',
    'ats.vacancy.read',
    'ats.vacancy.request',
    'performance.cycle.read',
    'performance.competency.read',
    'performance.scale.read',
    'performance.evaluation.read',
    'performance.evaluation.respond',
    'goals.cycle.read',
    'goals.goal.read',
    'goals.progress.update',
    'goals.completion.request',
  ],
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
