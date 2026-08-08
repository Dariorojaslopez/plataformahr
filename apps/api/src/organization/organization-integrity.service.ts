import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  async requireBusinessUnit(companyId: string, id: string) {
    const entity = await this.prisma.businessUnit.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Business unit not found');
    }
    return entity;
  }

  async requireArea(companyId: string, id: string) {
    const entity = await this.prisma.area.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Area not found');
    }
    return entity;
  }

  async requireJobLevel(companyId: string, id: string) {
    const entity = await this.prisma.jobLevel.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Job level not found');
    }
    return entity;
  }

  async requirePosition(companyId: string, id: string) {
    const entity = await this.prisma.position.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Position not found');
    }
    return entity;
  }

  async requireEmployee(companyId: string, id: string) {
    const entity = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Employee not found');
    }
    return entity;
  }

  async assertUserMembership(companyId: string, userId: string): Promise<void> {
    const membership = await this.prisma.companyMembership.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException(
        'Linked user must have an active membership in this company',
      );
    }
  }
}
