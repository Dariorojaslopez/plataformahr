/**
 * DEV/QA-ONLY seed: second company + a SEPARATE admin user for tenant isolation.
 * Forbidden when NODE_ENV=production.
 *
 * - Dev Company (A) stays with DEV_ADMIN_* from seed.dev (single company → direct dashboard).
 * - Dev Company B is owned by DEV_QA_ADMIN_* (defaults below).
 * - Platform Owner sees all companies via /platform — not via memberships.
 *
 * Usage:
 *   pnpm db:seed:qa
 *
 * Env (optional):
 *   DEV_QA_ADMIN_EMAIL / DEV_QA_ADMIN_PASSWORD
 *   DEV_ADMIN_EMAIL — used only to strip accidental membership on Company B
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

const DEFAULT_QA_ADMIN_EMAIL = 'admin-b@talento.local';
const DEFAULT_QA_ADMIN_PASSWORD = 'ChangeMeAdminB123!';

function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) return fallback;
  return value.trim();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed:qa is forbidden when NODE_ENV=production');
  }

  const qaAdminEmail = envOr(
    'DEV_QA_ADMIN_EMAIL',
    DEFAULT_QA_ADMIN_EMAIL,
  ).toLowerCase();
  const qaAdminPassword = envOr(
    'DEV_QA_ADMIN_PASSWORD',
    DEFAULT_QA_ADMIN_PASSWORD,
  );
  const primaryAdminEmail = (
    process.env.DEV_ADMIN_EMAIL ?? 'admin@talento.local'
  )
    .trim()
    .toLowerCase();

  if (qaAdminEmail === primaryAdminEmail) {
    throw new Error(
      'DEV_QA_ADMIN_EMAIL must differ from DEV_ADMIN_EMAIL so Company A admin stays single-tenant',
    );
  }

  const hash = await argon2.hash(qaAdminPassword, { type: argon2.argon2id });

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

  const qaAdmin = await prisma.user.upsert({
    where: { email: qaAdminEmail },
    create: {
      email: qaAdminEmail,
      passwordHash: hash,
      firstName: 'Client',
      lastName: 'Admin B',
      status: UserStatus.ACTIVE,
      isPlatformOwner: false,
    },
    update: {
      passwordHash: hash,
      firstName: 'Client',
      lastName: 'Admin B',
      status: UserStatus.ACTIVE,
      isPlatformOwner: false,
      deletedAt: null,
    },
  });

  const membership = await prisma.companyMembership.upsert({
    where: {
      userId_companyId: {
        userId: qaAdmin.id,
        companyId: companyB.id,
      },
    },
    create: {
      userId: qaAdmin.id,
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

  // Ensure primary Dev Company admin is NOT also a member of Company B
  // (legacy seed.qa attached both to the same user).
  const primaryAdmin = await prisma.user.findUnique({
    where: { email: primaryAdminEmail },
  });
  if (primaryAdmin) {
    const stray = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: primaryAdmin.id,
          companyId: companyB.id,
        },
      },
    });
    if (stray) {
      await prisma.membershipRole.deleteMany({
        where: { membershipId: stray.id },
      });
      await prisma.companyMembership.delete({ where: { id: stray.id } });
      console.log(
        `- Removed Company B membership from primary admin (${primaryAdminEmail})`,
      );
    }
  }

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
  console.log(`- Company A admin (unchanged): ${primaryAdminEmail}`);
  console.log(`- Company B admin: ${qaAdminEmail}`);
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
