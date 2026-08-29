import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EmployeeStatus,
  MembershipStatus,
} from '@prisma/client';
import { OrganizationIntegrityService } from '../../organization/organization-integrity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { POSITION_OCCUPANT_ERRORS } from '../ats.constants';
import {
  OccupantResolutionError,
  pickOccupant,
  type OccupantCandidate,
} from './position-occupant';

const OCCUPANT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  userId: true,
} as const;

@Injectable()
export class PositionOccupantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrity: OrganizationIntegrityService,
  ) {}

  async list(companyId: string, positionId: string) {
    await this.integrity.requirePosition(companyId, positionId);
    return this.listEligible(companyId, positionId);
  }

  async resolve(
    companyId: string,
    positionId: string | null | undefined,
    employeeId?: string | null,
  ) {
    if (!positionId) {
      throw new BadRequestException(POSITION_OCCUPANT_ERRORS.POSITION_REQUIRED);
    }
    await this.integrity.requirePosition(companyId, positionId);
    const occupants = await this.listEligible(companyId, positionId);
    try {
      return pickOccupant(occupants, employeeId);
    } catch (error) {
      if (error instanceof OccupantResolutionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async listEligible(
    companyId: string,
    positionId: string,
  ): Promise<OccupantCandidate[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        positionId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
        userId: { not: null },
      },
      select: OCCUPANT_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const userIds = employees
      .map((item) => item.userId)
      .filter((id): id is string => Boolean(id));
    if (userIds.length === 0) {
      return [];
    }
    const memberships = await this.prisma.companyMembership.findMany({
      where: {
        companyId,
        userId: { in: userIds },
        status: MembershipStatus.ACTIVE,
      },
      select: { userId: true },
    });
    const activeUsers = new Set(memberships.map((item) => item.userId));
    return employees.filter(
      (item) => item.userId && activeUsers.has(item.userId),
    );
  }
}
