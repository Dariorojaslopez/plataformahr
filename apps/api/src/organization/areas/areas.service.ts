import { BadRequestException, Injectable } from '@nestjs/common';
import { OrganizationEntityStatus, type Area } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import {
  assertNoCycle,
  emptyToNull,
  wouldCreateParentCycle,
} from '../organization.helpers';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';

export type AreaTreeNode = {
  id: string;
  name: string;
  code: string | null;
  status: OrganizationEntityStatus;
  businessUnitId: string | null;
  parentAreaId: string | null;
  children: AreaTreeNode[];
};

@Injectable()
export class AreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
  ) {}

  list(companyId: string): Promise<Area[]> {
    return this.prisma.area.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async tree(companyId: string): Promise<AreaTreeNode[]> {
    const areas = await this.prisma.area.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const nodes = new Map<string, AreaTreeNode>();
    for (const area of areas) {
      nodes.set(area.id, {
        id: area.id,
        name: area.name,
        code: area.code,
        status: area.status,
        businessUnitId: area.businessUnitId,
        parentAreaId: area.parentAreaId,
        children: [],
      });
    }

    const roots: AreaTreeNode[] = [];
    for (const area of areas) {
      const node = nodes.get(area.id);
      if (!node) continue;
      if (area.parentAreaId && nodes.has(area.parentAreaId)) {
        nodes.get(area.parentAreaId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateAreaDto,
  ): Promise<Area> {
    if (dto.businessUnitId) {
      await this.integrity.requireBusinessUnit(companyId, dto.businessUnitId);
    }
    if (dto.parentAreaId) {
      await this.integrity.requireArea(companyId, dto.parentAreaId);
      await this.assertAreaParentSafe(companyId, null, dto.parentAreaId);
    }

    const created = await this.prisma.area.create({
      data: {
        companyId,
        name: dto.name.trim(),
        code: emptyToNull(dto.code) ?? null,
        description: emptyToNull(dto.description) ?? null,
        businessUnitId: dto.businessUnitId ?? null,
        parentAreaId: dto.parentAreaId ?? null,
        status: dto.status ?? OrganizationEntityStatus.ACTIVE,
      },
    });

    await this.audit.create({
      action: ORG_AUDIT.AREA_CREATED,
      entity: 'Area',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: created.id },
    });

    return created;
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateAreaDto,
  ): Promise<Area> {
    await this.integrity.requireArea(companyId, id);

    if (dto.businessUnitId) {
      await this.integrity.requireBusinessUnit(companyId, dto.businessUnitId);
    }
    if (dto.parentAreaId) {
      if (dto.parentAreaId === id) {
        throw new BadRequestException('An area cannot be its own parent');
      }
      await this.integrity.requireArea(companyId, dto.parentAreaId);
      await this.assertAreaParentSafe(companyId, id, dto.parentAreaId);
    }

    const updated = await this.prisma.area.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: emptyToNull(dto.code) } : {}),
        ...(dto.description !== undefined
          ? { description: emptyToNull(dto.description) }
          : {}),
        ...(dto.businessUnitId !== undefined
          ? { businessUnitId: dto.businessUnitId }
          : {}),
        ...(dto.parentAreaId !== undefined
          ? { parentAreaId: dto.parentAreaId }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.create({
      action: ORG_AUDIT.AREA_UPDATED,
      entity: 'Area',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: updated.id },
    });

    return updated;
  }

  private async assertAreaParentSafe(
    companyId: string,
    areaId: string | null,
    parentAreaId: string,
  ): Promise<void> {
    const areas = await this.prisma.area.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentAreaId: true },
    });
    const parentsById = new Map(
      areas.map((area) => [area.id, area.parentAreaId]),
    );

    if (!areaId) {
      return;
    }

    assertNoCycle(
      wouldCreateParentCycle(areaId, parentAreaId, parentsById),
      'Area hierarchy cycle detected',
    );
  }
}
