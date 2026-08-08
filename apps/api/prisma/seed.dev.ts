/**
 * DEV-ONLY seed.
 * Creates a Platform Owner, a development company and a CLIENT_ADMIN user.
 * Refuses to run when NODE_ENV=production.
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
    // Optional when variables are already provided by the environment.
  }
}

loadEnvFile(join(__dirname, '../.env'));

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable for DEV seed: ${name}`,
    );
  }
  return value.trim();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed:dev is forbidden when NODE_ENV=production');
  }

  const ownerEmail = requireEnv('DEV_OWNER_EMAIL').toLowerCase();
  const ownerPassword = requireEnv('DEV_OWNER_PASSWORD');
  const adminEmail = requireEnv('DEV_ADMIN_EMAIL').toLowerCase();
  const adminPassword = requireEnv('DEV_ADMIN_PASSWORD');

  const ownerHash = await argon2.hash(ownerPassword, { type: argon2.argon2id });
  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      email: ownerEmail,
      passwordHash: ownerHash,
      firstName: 'Platform',
      lastName: 'Owner',
      status: UserStatus.ACTIVE,
      isPlatformOwner: true,
    },
    update: {
      passwordHash: ownerHash,
      firstName: 'Platform',
      lastName: 'Owner',
      status: UserStatus.ACTIVE,
      isPlatformOwner: true,
      deletedAt: null,
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: 'dev-company' },
    create: {
      name: 'Dev Company',
      slug: 'dev-company',
      status: CompanyStatus.ACTIVE,
    },
    update: {
      name: 'Dev Company',
      status: CompanyStatus.ACTIVE,
      deletedAt: null,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      firstName: 'Client',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      isPlatformOwner: false,
    },
    update: {
      passwordHash: adminHash,
      firstName: 'Client',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      isPlatformOwner: false,
      deletedAt: null,
    },
  });

  const membership = await prisma.companyMembership.upsert({
    where: {
      userId_companyId: {
        userId: admin.id,
        companyId: company.id,
      },
    },
    create: {
      userId: admin.id,
      companyId: company.id,
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

  console.log('DEV seed completed (idempotent).');
  console.log(`- Platform owner: ${owner.email}`);
  console.log(`- Company: ${company.slug} (${company.id})`);
  console.log(`- Client admin: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
