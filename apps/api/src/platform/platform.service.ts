import {
  BadRequestException,
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
import {
  COMPANY_ACCESS_CATALOG,
  mergeCompanyAccess,
  splitCompanyAccess,
  type CompanyFeatureCode,
  type CompanyModuleCode,
  type PremiumFeatureCode,
} from '@talento/shared';
import { randomBytes } from 'node:crypto';
import { PasswordHashingService } from '../auth/password-hashing.service';
import { AuditService } from '../core/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePlatformCompanyDto,
  ResetPlatformCompanyAdminPasswordDto,
  UpdatePlatformCompanyStatusDto,
  UpdatePlatformCompanyFeaturesDto,
} from './dto/platform-company.dto';
import type {
  UpdatePlatformCompanyBillingDto,
  UpdatePlatformCompanyPremiumDto,
} from './dto/platform-billing.dto';
import type {
  CreatePlatformOwnerDto,
  UpdatePlatformOwnerDto,
} from './dto/platform-owner.dto';
import {
  calculateBilling,
  EMPTY_BILLING_AMOUNTS,
  moneyToString,
  parseBillingDecimal,
} from './platform-billing.calc';

export type PlatformCompanyListItem = {
  id: string;
  name: string;
  slug: string;
};

export const PLATFORM_AUDIT = {
  COMPANY_CREATED: 'PLATFORM_COMPANY_CREATED',
  COMPANY_STATUS_CHANGED: 'PLATFORM_COMPANY_STATUS_CHANGED',
  TENANT_ADMIN_ACCESS_GRANTED: 'PLATFORM_TENANT_ADMIN_ACCESS_GRANTED',
  OWNER_CREATED: 'PLATFORM_OWNER_CREATED',
  OWNER_UPDATED: 'PLATFORM_OWNER_UPDATED',
  OWNER_PASSWORD_RESET: 'PLATFORM_OWNER_PASSWORD_RESET',
  COMPANY_FEATURES_UPDATED: 'PLATFORM_COMPANY_FEATURES_UPDATED',
  COMPANY_PREMIUM_UPDATED: 'PLATFORM_COMPANY_PREMIUM_UPDATED',
  COMPANY_BILLING_UPDATED: 'PLATFORM_COMPANY_BILLING_UPDATED',
  COMPANY_ADMIN_PASSWORD_RESET: 'PLATFORM_COMPANY_ADMIN_PASSWORD_RESET',
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
        modules: {
          where: { enabled: true },
          select: { module: true },
        },
        features: {
          where: { enabled: true },
          select: { feature: true },
        },
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
      enabledModules: company.modules.map(({ module }) => module),
      enabledFeatures: company.features.map(({ feature }) => feature),
      initialAdmin:
        company.memberships.find(
          (membership) => !membership.user.isPlatformOwner,
        )?.user ?? null,
    }));
  }

  async createCompany(actorUserId: string, dto: CreatePlatformCompanyDto) {
    this.validateFeatureConfiguration(dto.enabledModules, dto.enabledFeatures);
    const temporaryPassword =
      dto.initialPassword ?? randomBytes(18).toString('base64url');
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
        await tx.companyModule.createMany({
          data: dto.enabledModules.map((module) => ({
            companyId: company.id,
            module: module,
            enabled: true,
          })),
        });
        await tx.companyFeature.createMany({
          data: dto.enabledFeatures.map((feature) => ({
            companyId: company.id,
            feature,
            enabled: true,
          })),
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

  async getCompanyFeatures(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: {
        modules: { where: { enabled: true }, select: { module: true } },
        features: { where: { enabled: true }, select: { feature: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      enabledModules: company.modules.map(({ module }) => module),
      enabledFeatures: company.features.map(({ feature }) => feature),
    };
  }

  async updateCompanyFeatures(
    actorUserId: string,
    companyId: string,
    dto: UpdatePlatformCompanyFeaturesDto,
  ) {
    const current = await this.getCompanyFeatures(companyId);
    const currentSplit = splitCompanyAccess(
      current.enabledModules,
      current.enabledFeatures,
    );
    const incoming = splitCompanyAccess(
      dto.enabledModules,
      dto.enabledFeatures,
    );
    const merged = mergeCompanyAccess(
      incoming.modules,
      incoming.features,
      currentSplit.premiumFeatures,
    );
    await this.replaceCompanyAccess(companyId, merged);
    await this.audit.create({
      action: PLATFORM_AUDIT.COMPANY_FEATURES_UPDATED,
      entity: 'Company',
      entityId: companyId,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: {
        enabledModules: merged.enabledModules,
        enabledFeatures: merged.enabledFeatures,
      },
    });
    return this.getCompanyFeatures(companyId);
  }

  async updateCompanyPremium(
    actorUserId: string,
    companyId: string,
    dto: UpdatePlatformCompanyPremiumDto,
  ) {
    const current = await this.getCompanyFeatures(companyId);
    const currentSplit = splitCompanyAccess(
      current.enabledModules,
      current.enabledFeatures,
    );
    const premium: PremiumFeatureCode[] = [];
    if (dto.digitalSignature) premium.push('premium.digital-signature');
    if (dto.interviewRecording) premium.push('premium.interview-recording');
    if (dto.pdi) premium.push('premium.pdi');
    const merged = mergeCompanyAccess(
      currentSplit.modules,
      currentSplit.features,
      premium,
    );
    await this.replaceCompanyAccess(companyId, merged);
    await this.audit.create({
      action: PLATFORM_AUDIT.COMPANY_PREMIUM_UPDATED,
      entity: 'Company',
      entityId: companyId,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: {
        digitalSignature: dto.digitalSignature,
        interviewRecording: dto.interviewRecording,
        pdi: dto.pdi,
      },
    });
    return this.getCompanyFeatures(companyId);
  }

  async listBilling() {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { billing: true },
    });
    const items = companies.map((company) =>
      this.toBillingItem(
        company.id,
        company.name,
        company.billing
          ? {
              taxAmount: company.billing.taxAmount,
              licenseAmount: company.billing.licenseAmount,
              subscriptionAmount: company.billing.subscriptionAmount,
              marginPercent: company.billing.marginPercent,
            }
          : EMPTY_BILLING_AMOUNTS,
      ),
    );
    const totals = items.reduce(
      (acc, item) => ({
        costTotal: acc.costTotal.plus(item.costTotal),
        chargedAmount: acc.chargedAmount.plus(item.chargedAmount),
        netProfit: acc.netProfit.plus(item.netProfit),
      }),
      {
        costTotal: new Prisma.Decimal(0),
        chargedAmount: new Prisma.Decimal(0),
        netProfit: new Prisma.Decimal(0),
      },
    );
    return {
      items: items.map((item) => this.serializeBillingItem(item)),
      totals: {
        costTotal: moneyToString(totals.costTotal.toDecimalPlaces(2)),
        chargedAmount: moneyToString(totals.chargedAmount.toDecimalPlaces(2)),
        netProfit: moneyToString(totals.netProfit.toDecimalPlaces(2)),
      },
    };
  }

  async updateCompanyBilling(
    actorUserId: string,
    companyId: string,
    dto: UpdatePlatformCompanyBillingDto,
  ) {
    const exists = await this.prisma.company.count({
      where: { id: companyId, deletedAt: null },
    });
    if (!exists) throw new NotFoundException('Company not found');

    let taxAmount: Prisma.Decimal;
    let licenseAmount: Prisma.Decimal;
    let subscriptionAmount: Prisma.Decimal;
    let marginPercent: Prisma.Decimal;
    try {
      taxAmount = parseBillingDecimal(dto.taxAmount, 'taxAmount');
      licenseAmount = parseBillingDecimal(dto.licenseAmount, 'licenseAmount');
      subscriptionAmount = parseBillingDecimal(
        dto.subscriptionAmount,
        'subscriptionAmount',
      );
      marginPercent = parseBillingDecimal(dto.marginPercent, 'marginPercent');
    } catch {
      throw new BadRequestException(
        'Los montos de facturación no son válidos.',
      );
    }
    if (marginPercent.greaterThan(100)) {
      throw new BadRequestException('El margen no puede superar 100%.');
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        billing: {
          upsert: {
            create: {
              taxAmount,
              licenseAmount,
              subscriptionAmount,
              marginPercent,
            },
            update: {
              taxAmount,
              licenseAmount,
              subscriptionAmount,
              marginPercent,
            },
          },
        },
      },
      include: { billing: true },
    });

    await this.audit.create({
      action: PLATFORM_AUDIT.COMPANY_BILLING_UPDATED,
      entity: 'CompanyBilling',
      entityId: company.billing!.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: {
        taxAmount: moneyToString(taxAmount),
        licenseAmount: moneyToString(licenseAmount),
        subscriptionAmount: moneyToString(subscriptionAmount),
        marginPercent: moneyToString(marginPercent),
      },
    });

    return this.serializeBillingItem(
      this.toBillingItem(company.id, company.name, {
        taxAmount,
        licenseAmount,
        subscriptionAmount,
        marginPercent,
      }),
    );
  }

  private validateFeatureConfiguration(
    enabledModules: CompanyModuleCode[],
    enabledFeatures: CompanyFeatureCode[],
  ) {
    const modules = new Set(enabledModules);
    const invalid = enabledFeatures.find((feature) => {
      const parent = COMPANY_ACCESS_CATALOG.find(({ features }) =>
        features.some(({ code }) => code === feature),
      );
      return !parent || !modules.has(parent.code);
    });
    if (invalid) {
      throw new BadRequestException(
        `La opción ${invalid} requiere que su módulo esté habilitado.`,
      );
    }
  }

  private async replaceCompanyAccess(
    companyId: string,
    access: {
      enabledModules: CompanyModuleCode[];
      enabledFeatures: CompanyFeatureCode[];
    },
  ) {
    this.validateFeatureConfiguration(
      access.enabledModules,
      access.enabledFeatures,
    );
    const exists = await this.prisma.company.count({
      where: { id: companyId, deletedAt: null },
    });
    if (!exists) throw new NotFoundException('Company not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.companyModule.updateMany({
        where: { companyId },
        data: { enabled: false },
      });
      await tx.companyFeature.updateMany({
        where: { companyId },
        data: { enabled: false },
      });
      for (const module of access.enabledModules) {
        await tx.companyModule.upsert({
          where: {
            companyId_module: {
              companyId,
              module,
            },
          },
          create: {
            companyId,
            module,
            enabled: true,
          },
          update: { enabled: true },
        });
      }
      for (const feature of access.enabledFeatures) {
        await tx.companyFeature.upsert({
          where: { companyId_feature: { companyId, feature } },
          create: { companyId, feature, enabled: true },
          update: { enabled: true },
        });
      }
    });
  }

  private toBillingItem(
    companyId: string,
    companyName: string,
    amounts: {
      taxAmount: Prisma.Decimal;
      licenseAmount: Prisma.Decimal;
      subscriptionAmount: Prisma.Decimal;
      marginPercent: Prisma.Decimal;
    },
  ) {
    const totals = calculateBilling(amounts);
    return {
      companyId,
      companyName,
      ...amounts,
      ...totals,
    };
  }

  private serializeBillingItem(
    item: ReturnType<PlatformService['toBillingItem']>,
  ) {
    return {
      companyId: item.companyId,
      companyName: item.companyName,
      taxAmount: moneyToString(item.taxAmount),
      licenseAmount: moneyToString(item.licenseAmount),
      subscriptionAmount: moneyToString(item.subscriptionAmount),
      marginPercent: moneyToString(item.marginPercent),
      costTotal: moneyToString(item.costTotal),
      chargedAmount: moneyToString(item.chargedAmount),
      netProfit: moneyToString(item.netProfit),
    };
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

  async resetCompanyAdminPassword(
    actorUserId: string,
    companyId: string,
    dto: ResetPlatformCompanyAdminPasswordDto,
  ) {
    const membership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId,
        company: { deletedAt: null },
        user: { isPlatformOwner: false, deletedAt: null },
        roles: {
          some: {
            role: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Company administrator not found');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: membership.userId },
        data: { passwordHash, mustChangePassword: true },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.create({
      action: PLATFORM_AUDIT.COMPANY_ADMIN_PASSWORD_RESET,
      entity: 'User',
      entityId: membership.userId,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: {
        companyId,
        adminUserId: membership.userId,
        sessionsRevoked: true,
      },
    });
    return { ok: true };
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

  async listPlatformOwners() {
    return this.prisma.user.findMany({
      where: { isPlatformOwner: true, deletedAt: null },
      orderBy: [{ status: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        isPlatformOwner: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createPlatformOwner(actorUserId: string, dto: CreatePlatformOwnerDto) {
    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);
    try {
      const owner = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          status: UserStatus.ACTIVE,
          isPlatformOwner: true,
          mustChangePassword: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          isPlatformOwner: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      await this.audit.create({
        action: PLATFORM_AUDIT.OWNER_CREATED,
        entity: 'User',
        entityId: owner.id,
        user: { connect: { id: actorUserId } },
        metadata: { ownerUserId: owner.id },
      });
      return { owner, temporaryPassword };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un usuario con ese email.');
      }
      throw error;
    }
  }

  async updatePlatformOwner(
    actorUserId: string,
    ownerId: string,
    dto: UpdatePlatformOwnerDto,
  ) {
    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.user.findFirst({
            where: { id: ownerId, isPlatformOwner: true, deletedAt: null },
          });
          if (!existing)
            throw new NotFoundException('Platform owner not found');

          const removesOwnAccess =
            ownerId === actorUserId &&
            (dto.isPlatformOwner === false ||
              (dto.status !== undefined && dto.status !== UserStatus.ACTIVE));
          if (removesOwnAccess) {
            throw new BadRequestException(
              'No puedes bloquearte o quitarte el acceso de Platform Owner.',
            );
          }

          const removesActiveOwner =
            existing.status === UserStatus.ACTIVE &&
            (dto.isPlatformOwner === false ||
              (dto.status !== undefined && dto.status !== UserStatus.ACTIVE));
          if (removesActiveOwner) {
            const activeOwners = await tx.user.count({
              where: {
                isPlatformOwner: true,
                status: UserStatus.ACTIVE,
                deletedAt: null,
              },
            });
            if (activeOwners <= 1) {
              throw new ConflictException(
                'Debe permanecer al menos un Platform Owner activo.',
              );
            }
          }

          const user = await tx.user.update({
            where: { id: ownerId },
            data: {
              ...(dto.firstName !== undefined
                ? { firstName: dto.firstName.trim() }
                : {}),
              ...(dto.lastName !== undefined
                ? { lastName: dto.lastName.trim() }
                : {}),
              ...(dto.email !== undefined
                ? { email: dto.email.trim().toLowerCase() }
                : {}),
              ...(dto.status !== undefined ? { status: dto.status } : {}),
              ...(dto.isPlatformOwner !== undefined
                ? { isPlatformOwner: dto.isPlatformOwner }
                : {}),
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              isPlatformOwner: true,
              mustChangePassword: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          if (
            user.status !== UserStatus.ACTIVE ||
            user.isPlatformOwner === false
          ) {
            await tx.userSession.updateMany({
              where: { userId: ownerId, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }
          return user;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.audit.create({
        action: PLATFORM_AUDIT.OWNER_UPDATED,
        entity: 'User',
        entityId: ownerId,
        user: { connect: { id: actorUserId } },
        metadata: {
          ownerUserId: ownerId,
          status: updated.status,
          isPlatformOwner: updated.isPlatformOwner,
        },
      });
      return updated;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un usuario con ese email.');
      }
      throw error;
    }
  }

  async resetPlatformOwnerPassword(actorUserId: string, ownerId: string) {
    if (ownerId === actorUserId) {
      throw new BadRequestException(
        'No puedes restablecer tu propia contraseña desde esta consola.',
      );
    }
    const existing = await this.prisma.user.findFirst({
      where: { id: ownerId, isPlatformOwner: true, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Platform owner not found');

    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: ownerId },
        data: { passwordHash, mustChangePassword: true },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: ownerId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.create({
      action: PLATFORM_AUDIT.OWNER_PASSWORD_RESET,
      entity: 'User',
      entityId: ownerId,
      user: { connect: { id: actorUserId } },
      metadata: { ownerUserId: ownerId, sessionsRevoked: true },
    });
    return { temporaryPassword };
  }
}
