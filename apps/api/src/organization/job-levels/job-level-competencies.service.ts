import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import { COMPETENCY_SELECT } from '../job-level-competencies';
import type { ReplaceJobLevelCompetenciesDto } from './dto/job-level-competency.dto';

@Injectable()
export class JobLevelCompetenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
  ) {}

  async list(companyId: string, jobLevelId: string) {
    const jobLevel = await this.integrity.requireJobLevel(
      companyId,
      jobLevelId,
    );
    const [assignedLinks, catalog] = await Promise.all([
      this.prisma.jobLevelCompetency.findMany({
        where: {
          companyId,
          jobLevelId,
          competency: { deletedAt: null },
        },
        select: { competency: { select: COMPETENCY_SELECT } },
        orderBy: { competency: { name: 'asc' } },
      }),
      this.prisma.competency.findMany({
        where: { companyId, deletedAt: null },
        select: COMPETENCY_SELECT,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      jobLevelId: jobLevel.id,
      jobLevel: {
        id: jobLevel.id,
        name: jobLevel.name,
        code: jobLevel.code,
        rank: jobLevel.rank,
      },
      assigned: assignedLinks.map((link) => link.competency),
      catalog,
    };
  }

  async replace(
    companyId: string,
    userId: string,
    jobLevelId: string,
    dto: ReplaceJobLevelCompetenciesDto,
  ) {
    await this.integrity.requireJobLevel(companyId, jobLevelId);
    const competencyIds = dto.competencyIds;

    if (competencyIds.length > 0) {
      const found = await this.prisma.competency.findMany({
        where: {
          id: { in: competencyIds },
          companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (found.length !== competencyIds.length) {
        throw new NotFoundException('Competency not found');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobLevelCompetency.deleteMany({
        where: { companyId, jobLevelId },
      });
      for (const competencyId of competencyIds) {
        await tx.jobLevelCompetency.create({
          data: { companyId, jobLevelId, competencyId },
        });
      }
    });

    await this.audit.create({
      action: ORG_AUDIT.JOB_LEVEL_COMPETENCIES_UPDATED,
      entity: 'JobLevel',
      entityId: jobLevelId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { jobLevelId, competencyIds },
    });

    return this.list(companyId, jobLevelId);
  }
}
