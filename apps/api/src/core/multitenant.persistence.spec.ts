import {
  PlatformModule,
  Prisma,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnvFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(__dirname, '../../.env'));

const prisma = new PrismaClient();

function runSeed(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    cwd: join(__dirname, '../..'),
    env: process.env,
    stdio: 'pipe',
  });
}

describe('Core multi-tenant persistence', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs seed idempotently without duplicating roles or permissions', async () => {
    runSeed();
    runSeed();

    const roles = await prisma.role.findMany({
      where: { scope: RoleScope.COMPANY },
    });
    const permissions = await prisma.permission.findMany();
    const rolePermissions = await prisma.rolePermission.findMany({
      include: { role: true, permission: true },
    });

    expect(roles.map((role) => role.code).sort()).toEqual([
      'CLIENT_ADMIN',
      'COLLABORATOR',
      'LEADER',
      'PERFORMANCE_MANAGER',
      'RECRUITER',
    ]);
    expect(permissions.map((permission) => permission.code).sort()).toEqual([
      'ats.application.manage',
      'ats.application.read',
      'ats.candidate.manage',
      'ats.candidate.read',
      'ats.hiring.manage',
      'ats.hiring.read',
      'ats.interview.evaluate',
      'ats.interview.manage',
      'ats.interview.read',
      'ats.interview.transcribe',
      'ats.offer.manage',
      'ats.offer.read',
      'ats.offer.respond',
      'ats.vacancy.approve',
      'ats.vacancy.manage',
      'ats.vacancy.read',
      'ats.vacancy.request',
      'company.manage',
      'company.read',
      'goals.completion.request',
      'goals.completion.review',
      'goals.cycle.manage',
      'goals.cycle.read',
      'goals.goal.assign',
      'goals.goal.manage',
      'goals.goal.read',
      'goals.progress.update',
      'organization.manage',
      'organization.read',
      'performance.analytics.read',
      'performance.competency.manage',
      'performance.competency.read',
      'performance.cycle.manage',
      'performance.cycle.read',
      'performance.evaluation.manage',
      'performance.evaluation.read',
      'performance.evaluation.respond',
      'performance.result.manage',
      'performance.result.read',
      'performance.result.release',
      'performance.scale.manage',
      'performance.scale.read',
      'users.manage',
      'users.read',
    ]);

    const clientAdminPerms = rolePermissions
      .filter((link) => link.role.code === 'CLIENT_ADMIN')
      .map((link) => link.permission.code)
      .sort();
    expect(clientAdminPerms).toEqual([
      'ats.application.manage',
      'ats.application.read',
      'ats.candidate.manage',
      'ats.candidate.read',
      'ats.hiring.manage',
      'ats.hiring.read',
      'ats.interview.evaluate',
      'ats.interview.manage',
      'ats.interview.read',
      'ats.interview.transcribe',
      'ats.offer.manage',
      'ats.offer.read',
      'ats.offer.respond',
      'ats.vacancy.approve',
      'ats.vacancy.manage',
      'ats.vacancy.read',
      'ats.vacancy.request',
      'company.manage',
      'company.read',
      'goals.completion.request',
      'goals.completion.review',
      'goals.cycle.manage',
      'goals.cycle.read',
      'goals.goal.assign',
      'goals.goal.manage',
      'goals.goal.read',
      'goals.progress.update',
      'organization.manage',
      'organization.read',
      'performance.analytics.read',
      'performance.competency.manage',
      'performance.competency.read',
      'performance.cycle.manage',
      'performance.cycle.read',
      'performance.evaluation.manage',
      'performance.evaluation.read',
      'performance.evaluation.respond',
      'performance.result.manage',
      'performance.result.read',
      'performance.result.release',
      'performance.scale.manage',
      'performance.scale.read',
      'users.manage',
      'users.read',
    ]);

    const collaboratorPerms = rolePermissions
      .filter((link) => link.role.code === 'COLLABORATOR')
      .map((link) => link.permission.code)
      .sort();
    expect(collaboratorPerms).toEqual([
      'ats.vacancy.read',
      'ats.vacancy.request',
      'company.read',
      'goals.completion.request',
      'goals.cycle.read',
      'goals.goal.read',
      'goals.progress.update',
      'organization.read',
      'performance.competency.read',
      'performance.cycle.read',
      'performance.evaluation.read',
      'performance.evaluation.respond',
      'performance.scale.read',
    ]);
  });

  it('allows a user in multiple companies and a company with multiple memberships', async () => {
    const user = await prisma.user.create({
      data: {
        email: `multi-company-${suffix}@example.com`,
        firstName: 'Ada',
        lastName: 'Lovelace',
        status: UserStatus.ACTIVE,
      },
    });

    const companyA = await prisma.company.create({
      data: {
        name: `Company A ${suffix}`,
        slug: `company-a-${suffix}`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Company B ${suffix}`,
        slug: `company-b-${suffix}`,
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        email: `other-${suffix}@example.com`,
        firstName: 'Grace',
        lastName: 'Hopper',
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.companyMembership.create({
      data: { userId: user.id, companyId: companyA.id },
    });
    await prisma.companyMembership.create({
      data: { userId: user.id, companyId: companyB.id },
    });
    await prisma.companyMembership.create({
      data: { userId: otherUser.id, companyId: companyA.id },
    });

    const userMemberships = await prisma.companyMembership.findMany({
      where: { userId: user.id },
    });
    const companyAMemberships = await prisma.companyMembership.findMany({
      where: { companyId: companyA.id },
    });

    expect(userMemberships).toHaveLength(2);
    expect(companyAMemberships).toHaveLength(2);
  });

  it('allows multiple roles per membership and rejects duplicate memberships', async () => {
    const user = await prisma.user.create({
      data: {
        email: `roles-${suffix}@example.com`,
        firstName: 'Alan',
        lastName: 'Turing',
        status: UserStatus.ACTIVE,
      },
    });
    const company = await prisma.company.create({
      data: {
        name: `Roles Co ${suffix}`,
        slug: `roles-co-${suffix}`,
      },
    });
    const membership = await prisma.companyMembership.create({
      data: { userId: user.id, companyId: company.id },
    });

    const leader = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'LEADER' },
      },
    });
    const recruiter = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'RECRUITER' },
      },
    });

    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: leader.id },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: recruiter.id },
    });

    const roles = await prisma.membershipRole.findMany({
      where: { membershipId: membership.id },
    });
    expect(roles).toHaveLength(2);

    await expect(
      prisma.companyMembership.create({
        data: { userId: user.id, companyId: company.id },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('rejects duplicate CompanyModule for the same company and module', async () => {
    const company = await prisma.company.create({
      data: {
        name: `Modules Co ${suffix}`,
        slug: `modules-co-${suffix}`,
      },
    });

    await prisma.companyModule.create({
      data: {
        companyId: company.id,
        module: PlatformModule.ATS,
        enabled: true,
      },
    });

    await expect(
      prisma.companyModule.create({
        data: {
          companyId: company.id,
          module: PlatformModule.ATS,
          enabled: false,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('enforces unique user email and company slug', async () => {
    await prisma.user.create({
      data: {
        email: `unique-${suffix}@example.com`,
        firstName: 'Unique',
        lastName: 'User',
      },
    });
    await expect(
      prisma.user.create({
        data: {
          email: `unique-${suffix}@example.com`,
          firstName: 'Clone',
          lastName: 'User',
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    await prisma.company.create({
      data: {
        name: `Unique Slug ${suffix}`,
        slug: `unique-slug-${suffix}`,
      },
    });
    await expect(
      prisma.company.create({
        data: {
          name: `Other Name ${suffix}`,
          slug: `unique-slug-${suffix}`,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
