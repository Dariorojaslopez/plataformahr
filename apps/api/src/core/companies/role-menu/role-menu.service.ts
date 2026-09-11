import { Injectable } from '@nestjs/common';
import {
  CONFIGURABLE_COMPANY_ROLES,
  ROLE_MENU_CATALOG,
  defaultMenuHrefsForRole,
  type ConfigurableCompanyRole,
} from '@talento/shared';
import type { TenantContext } from '../../../auth/auth.types';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  COMPANY_ROLE_MENU_AUDIT,
  COMPANY_ROLE_MENU_ENTITY,
} from './role-menu.constants';
import type { UpdateRoleMenusDto } from './dto/update-role-menu.dto';

export type RoleMenuConfigResponse = {
  roles: Array<{
    roleCode: ConfigurableCompanyRole;
    hrefs: string[];
    customized: boolean;
  }>;
  catalog: typeof ROLE_MENU_CATALOG;
};

@Injectable()
export class RoleMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listOverrides(companyId: string): Promise<Record<string, string[]>> {
    const rows = await this.prisma.companyRoleMenu.findMany({
      where: { companyId },
      select: { roleCode: true, hrefs: true },
    });
    return Object.fromEntries(rows.map((row) => [row.roleCode, row.hrefs]));
  }

  async getConfig(companyId: string): Promise<RoleMenuConfigResponse> {
    const overrides = await this.listOverrides(companyId);
    return {
      catalog: ROLE_MENU_CATALOG,
      roles: CONFIGURABLE_COMPANY_ROLES.map((roleCode) => ({
        roleCode,
        customized: Object.prototype.hasOwnProperty.call(overrides, roleCode),
        hrefs: overrides[roleCode] ?? defaultMenuHrefsForRole(roleCode),
      })),
    };
  }

  async replaceAll(
    tenant: TenantContext,
    dto: UpdateRoleMenusDto,
  ): Promise<RoleMenuConfigResponse> {
    const incoming = new Map(
      dto.roles.map((item) => [item.roleCode, [...new Set(item.hrefs)]]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.companyRoleMenu.deleteMany({
        where: { companyId: tenant.companyId },
      });
      if (incoming.size === 0) return;
      await tx.companyRoleMenu.createMany({
        data: [...incoming.entries()].map(([roleCode, hrefs]) => ({
          companyId: tenant.companyId,
          roleCode,
          hrefs,
        })),
      });
    });

    await this.audit.create({
      action: COMPANY_ROLE_MENU_AUDIT.UPDATED,
      entity: COMPANY_ROLE_MENU_ENTITY,
      entityId: tenant.companyId,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: {
        roles: Object.fromEntries(incoming),
      },
    });

    return this.getConfig(tenant.companyId);
  }
}
