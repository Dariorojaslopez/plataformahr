/**
 * DEV/QA-ONLY seed: second company + membership for tenant isolation tests.
 * Forbidden when NODE_ENV=production.
 *
 * Usage:
 *   pnpm --filter api prisma:seed:qa
 *
 * Env (optional overrides):
 *   DEV_QA_ADMIN_EMAIL / DEV_QA_ADMIN_PASSWORD
 * Defaults to DEV_ADMIN_* with a second company membership, or creates
 * qa-admin@example.local if configured separately.
 */
import {
  CompanyStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex);
      const value = trimmed.slice(separatorIndex + 1);
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

loadEnvFile(join(__dirname, '../.env'));

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env for QA seed: ${name}`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed:qa is forbidden when NODE_ENV=production');
  }

  const adminEmail = (
    process.env.DEV_QA_ADMIN_EMAIL ?? requireEnv('DEV_ADMIN_EMAIL')
  ).toLowerCase();
  const adminPassword =
    process.env.DEV_QA_ADMIN_PASSWORD ?? requireEnv('DEV_ADMIN_PASSWORD');

  const hash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: hash,
      firstName: 'Client',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      isPlatformOwner: false,
    },
    update: {
      passwordHash: hash,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
  });

  const companyB = await prisma.company.upsert({
    where: { slug: 'dev-company-b' },
    create: {
      name: 'Dev Company B',
      slug: 'dev-company-b',
      status: CompanyStatus.ACTIVE,
    },
    update: {
      name: 'Dev Company B',
      status: CompanyStatus.ACTIVE,
      deletedAt: null,
    },
  });

  const membership = await prisma.companyMembership.upsert({
    where: {
      userId_companyId: {
        userId: admin.id,
        companyId: companyB.id,
      },
    },
    create: {
      userId: admin.id,
      companyId: companyB.id,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      status: MembershipStatus.ACTIVE,
    },
  });

  const clientAdminRole = await prisma.role.findUniqueOrThrow({
    where: {
      scope_code: {
        scope: RoleScope.COMPANY,
        code: 'CLIENT_ADMIN',
      },
    },
  });

  await prisma.membershipRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: clientAdminRole.id,
      },
    },
    create: {
      membershipId: membership.id,
      roleId: clientAdminRole.id,
    },
    update: {},
  });

  // Distinct org marker for company B (easy visual isolation check)
  await prisma.businessUnit.upsert({
    where: {
      companyId_code: {
        companyId: companyB.id,
        code: 'BU-B',
      },
    },
    create: {
      companyId: companyB.id,
      name: 'Unidad Marker B',
      code: 'BU-B',
      description: 'QA isolation marker — Company B only',
    },
    update: {
      name: 'Unidad Marker B',
      deletedAt: null,
    },
  });

  console.log('QA seed completed (idempotent, DEV only).');
  console.log(`- Admin: ${admin.email}`);
  console.log(`- Company B: ${companyB.slug} (${companyB.id})`);
  console.log('- Marker BU: Unidad Marker B / BU-B');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
