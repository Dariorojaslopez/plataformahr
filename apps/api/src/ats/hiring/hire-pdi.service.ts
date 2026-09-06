import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InterviewStatus,
  PerformanceCycleStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { buildHirePdiDraft, renderHirePdiText } from './hire-pdi';

export type HirePdiSyncResult = {
  status: 'SYNCED' | 'SKIPPED_NO_FEATURE' | 'SKIPPED_NO_CYCLE' | 'SKIPPED_EMPTY';
  cycleId?: string;
  cycleName?: string;
  pdiId?: string;
  draftName?: string;
};

@Injectable()
export class HirePdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDraft(companyId: string, applicationId: string) {
    const ctx = await this.loadContext(companyId, applicationId);
    const draft = buildHirePdiDraft({
      candidateFirstName: ctx.candidate.firstName,
      candidateLastName: ctx.candidate.lastName,
      vacancyTitle: ctx.vacancy.title,
      interviews: ctx.interviewSources,
    });
    return {
      applicationId,
      candidateName:
        `${ctx.candidate.firstName} ${ctx.candidate.lastName}`.trim(),
      vacancyTitle: ctx.vacancy.title,
      draft,
      canDownload: true,
    };
  }

  async downloadText(companyId: string, applicationId: string) {
    const ctx = await this.loadContext(companyId, applicationId);
    const draft = buildHirePdiDraft({
      candidateFirstName: ctx.candidate.firstName,
      candidateLastName: ctx.candidate.lastName,
      vacancyTitle: ctx.vacancy.title,
      interviews: ctx.interviewSources,
    });
    const text = renderHirePdiText({
      draft,
      candidateName:
        `${ctx.candidate.firstName} ${ctx.candidate.lastName}`.trim(),
      vacancyTitle: ctx.vacancy.title,
      companyName: ctx.companyName,
    });
    const safeName = draft.name
      .replace(/[^\w\- áéíóúñüÁÉÍÓÚÑÜ]+/gi, '')
      .trim()
      .slice(0, 80);
    return {
      text,
      filename: `${safeName || 'pdi'}.txt`,
    };
  }

  async syncOnHire(input: {
    companyId: string;
    userId: string;
    applicationId: string;
    employeeId: string;
  }): Promise<HirePdiSyncResult> {
    const hasFeature = await this.prisma.companyFeature.findFirst({
      where: {
        companyId: input.companyId,
        feature: 'premium.pdi',
        enabled: true,
      },
      select: { id: true },
    });
    if (!hasFeature) {
      return { status: 'SKIPPED_NO_FEATURE' };
    }

    const ctx = await this.loadContext(input.companyId, input.applicationId);
    const draft = buildHirePdiDraft({
      candidateFirstName: ctx.candidate.firstName,
      candidateLastName: ctx.candidate.lastName,
      vacancyTitle: ctx.vacancy.title,
      interviews: ctx.interviewSources,
    });

    if (!draft.strengths && !draft.improvements) {
      await this.audit.create({
        action: ATS_AUDIT.HIRE_PDI_SKIPPED,
        entity: 'Application',
        entityId: input.applicationId,
        company: { connect: { id: input.companyId } },
        user: { connect: { id: input.userId } },
        metadata: {
          reason: 'EMPTY',
          employeeId: input.employeeId,
        },
      });
      return { status: 'SKIPPED_EMPTY', draftName: draft.name };
    }

    const cycle = await this.prisma.performanceCycle.findFirst({
      where: {
        companyId: input.companyId,
        status: PerformanceCycleStatus.ACTIVE,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    });
    if (!cycle) {
      await this.audit.create({
        action: ATS_AUDIT.HIRE_PDI_SKIPPED,
        entity: 'Application',
        entityId: input.applicationId,
        company: { connect: { id: input.companyId } },
        user: { connect: { id: input.userId } },
        metadata: {
          reason: 'NO_ACTIVE_CYCLE',
          employeeId: input.employeeId,
          draftName: draft.name,
        },
      });
      return { status: 'SKIPPED_NO_CYCLE', draftName: draft.name };
    }

    const pdi = await this.prisma.performanceIndividualDevelopmentPlan.upsert({
      where: {
        cycleId_employeeId: {
          cycleId: cycle.id,
          employeeId: input.employeeId,
        },
      },
      create: {
        companyId: input.companyId,
        cycleId: cycle.id,
        employeeId: input.employeeId,
        name: draft.name,
        strengths: draft.strengths,
        improvements: draft.improvements,
        observations: draft.observations,
        progressPercent: 0,
      },
      update: {
        name: draft.name,
        strengths: draft.strengths,
        improvements: draft.improvements,
        observations: draft.observations,
      },
      select: { id: true },
    });

    await this.audit.create({
      action: ATS_AUDIT.HIRE_PDI_SYNCED,
      entity: 'PerformanceIndividualDevelopmentPlan',
      entityId: pdi.id,
      company: { connect: { id: input.companyId } },
      user: { connect: { id: input.userId } },
      metadata: {
        applicationId: input.applicationId,
        employeeId: input.employeeId,
        cycleId: cycle.id,
        cycleName: cycle.name,
        draftName: draft.name,
        sourceCount: draft.sourceCount,
      },
    });

    return {
      status: 'SYNCED',
      cycleId: cycle.id,
      cycleName: cycle.name,
      pdiId: pdi.id,
      draftName: draft.name,
    };
  }

  async syncFromApplication(
    companyId: string,
    userId: string,
    applicationId: string,
  ) {
    const hiring = await this.prisma.hiring.findFirst({
      where: { companyId, applicationId },
      select: { employeeId: true },
    });
    if (!hiring) {
      throw new NotFoundException(
        'La postulación aún no tiene contratación; el PDI a Performance se crea al contratar.',
      );
    }
    return this.syncOnHire({
      companyId,
      userId,
      applicationId,
      employeeId: hiring.employeeId,
    });
  }

  private async loadContext(companyId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
      select: {
        id: true,
        company: { select: { name: true } },
        candidate: {
          select: { firstName: true, lastName: true },
        },
        vacancy: { select: { title: true } },
        interviews: {
          where: {
            deletedAt: null,
            status: {
              in: [InterviewStatus.COMPLETED, InterviewStatus.IN_PROGRESS],
            },
          },
          select: {
            strengths: true,
            improvements: true,
            completedAt: true,
            interviewers: {
              select: {
                employee: {
                  select: { firstName: true, lastName: true },
                },
              },
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return {
      companyName: application.company.name,
      candidate: application.candidate,
      vacancy: application.vacancy,
      interviewSources: application.interviews.map((row) => {
        const interviewer = row.interviewers[0]?.employee;
        return {
          strengths: row.strengths,
          improvements: row.improvements,
          completedAt: row.completedAt,
          interviewerLabel: interviewer
            ? `${interviewer.firstName} ${interviewer.lastName}`.trim()
            : null,
        };
      }),
    };
  }
}
