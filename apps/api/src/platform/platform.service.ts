import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyStatus,
  MembershipStatus,
  Prisma,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PasswordHashingService } from '../auth/password-hashing.service';
import { AuditService } from '../core/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePlatformCompanyDto,
  UpdatePlatformCompanyStatusDto,
} from './dto/platform-company.dto';

export type PlatformCompanyListItem = {
  id: string;
  name: string;
  slug: string;
};

export const PLATFORM_AUDIT = {
  COMPANY_CREATED: 'PLATFORM_COMPANY_CREATED',
  COMPANY_STATUS_CHANGED: 'PLATFORM_COMPANY_STATUS_CHANGED',
  TENANT_ADMIN_ACCESS_GRANTED: 'PLATFORM_TENANT_ADMIN_ACCESS_GRANTED',
} as const;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHashingService,
    private readonly audit: AuditService,
  ) {}

  async listActiveCompanies(): Promise<PlatformCompanyListItem[]> {
    const companies = await this.prisma.company.findMany({
      where: {
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
    return companies;
  }

  async listManagedCompanies() {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          where: {
            roles: {
              some: {
                role: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
              },
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isPlatformOwner: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { memberships: true } },
      },
    });
    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      status: company.status,
      createdAt: company.createdAt,
      membershipCount: company._count.memberships,
      initialAdmin:
        company.memberships.find(
          (membership) => !membership.user.isPlatformOwner,
        )?.user ?? null,
    }));
  }

  async createCompany(actorUserId: string, dto: CreatePlatformCompanyDto) {
    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const role = await this.prisma.role.findUnique({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });
    if (!role) {
      throw new ConflictException('CLIENT_ADMIN role is not provisioned');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: dto.name.trim(),
            legalName: dto.legalName?.trim() || null,
            slug: dto.slug.trim().toLowerCase(),
            status: CompanyStatus.ACTIVE,
          },
        });
        const admin = await tx.user.create({
          data: {
            email: dto.adminEmail.trim().toLowerCase(),
            passwordHash,
            firstName: dto.adminFirstName.trim(),
            lastName: dto.adminLastName.trim(),
            status: UserStatus.ACTIVE,
            mustChangePassword: true,
          },
        });
        const adminMembership = await tx.companyMembership.create({
          data: {
            userId: admin.id,
            companyId: company.id,
            status: MembershipStatus.ACTIVE,
          },
        });
        await tx.membershipRole.create({
          data: { membershipId: adminMembership.id, roleId: role.id },
        });

        const ownerMembership = await tx.companyMembership.create({
          data: {
            userId: actorUserId,
            companyId: company.id,
            status: MembershipStatus.ACTIVE,
          },
        });
        await tx.membershipRole.create({
          data: { membershipId: ownerMembership.id, roleId: role.id },
        });
        return { company, admin };
      });

      await this.audit.create({
        action: PLATFORM_AUDIT.COMPANY_CREATED,
        entity: 'Company',
        entityId: created.company.id,
        company: { connect: { id: created.company.id } },
        user: { connect: { id: actorUserId } },
        metadata: {
          companyId: created.company.id,
          adminUserId: created.admin.id,
        },
      });

      return {
        company: {
          id: created.company.id,
          name: created.company.name,
          legalName: created.company.legalName,
          slug: created.company.slug,
          status: created.company.status,
        },
        initialAdmin: {
          id: created.admin.id,
          email: created.admin.email,
          firstName: created.admin.firstName,
          lastName: created.admin.lastName,
        },
        temporaryPassword,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una compañía con ese slug o un usuario con ese email.',
        );
      }
      throw error;
    }
  }

  async updateStatus(
    actorUserId: string,
    companyId: string,
    dto: UpdatePlatformCompanyStatusDto,
  ) {
    const existing = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Company not found');
    if (existing.status === dto.status) return existing;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { status: dto.status },
    });
    await this.audit.create({
      action: PLATFORM_AUDIT.COMPANY_STATUS_CHANGED,
      entity: 'Company',
      entityId: companyId,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: { from: existing.status, to: updated.status },
    });
    return updated;
  }

  async grantTenantAdminAccess(actorUserId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      },
    });
    if (!company) throw new NotFoundException('Company not available');
    const role = await this.prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });

    const membership = await this.prisma.companyMembership.upsert({
      where: {
        userId_companyId: { userId: actorUserId, companyId },
      },
      create: {
        userId: actorUserId,
        companyId,
        status: MembershipStatus.ACTIVE,
      },
      update: { status: MembershipStatus.ACTIVE },
    });
    await this.prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: { membershipId: membership.id, roleId: role.id },
      },
      create: { membershipId: membership.id, roleId: role.id },
      update: {},
    });
    await this.audit.create({
      action: PLATFORM_AUDIT.TENANT_ADMIN_ACCESS_GRANTED,
      entity: 'CompanyMembership',
      entityId: membership.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: { companyId, membershipId: membership.id },
    });
    return { id: company.id, name: company.name, slug: company.slug };
  }
}
