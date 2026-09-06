import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  CandidateStatus,
  ContractApprovalStatus,
  EmployeeStatus,
  JobOfferStatus,
  PreHireCheckStatus,
  Prisma,
  VacancyStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { OrganizationIntegrityService } from '../../organization/organization-integrity.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { HirePdiService } from './hire-pdi.service';
import { renderThankYouLetter } from './thank-you-letter';
import type { CreateHiringDto } from './dto/hiring.dto';
import { isPreHireClear } from './prehire.constants';

const HIRING_INCLUDE = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      hireDate: true,
      positionId: true,
      areaId: true,
      businessUnitId: true,
    },
  },
  jobOffer: {
    select: {
      id: true,
      status: true,
      positionTitle: true,
    },
  },
  application: {
    select: {
      id: true,
      stage: true,
      status: true,
      candidateId: true,
      vacancyId: true,
    },
  },
} as const;

@Injectable()
export class HiringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
    private readonly mail: MailService,
    private readonly hirePdi: HirePdiService,
  ) {}

  async getByApplication(companyId: string, applicationId: string) {
    await this.requireApplication(companyId, applicationId);
    const hiring = await this.prisma.hiring.findFirst({
      where: { companyId, applicationId },
      include: HIRING_INCLUDE,
    });
    if (!hiring) {
      throw new NotFoundException('Hiring not found');
    }
    return hiring;
  }

  async hire(
    companyId: string,
    userId: string,
    applicationId: string,
    dto: CreateHiringDto,
  ) {
    const hireDate = dto.hireDate
      ? new Date(dto.hireDate)
      : new Date(new Date().toISOString().slice(0, 10));

    if (dto.businessUnitId) {
      await this.integrity.requireBusinessUnit(companyId, dto.businessUnitId);
    }

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Lock vacancy before the application so concurrent hires on different
        // finalists serialize here instead of deadlocking when discarding siblings.
        const vacancyIdRow = await tx.application.findFirst({
          where: { id: applicationId, companyId, deletedAt: null },
          select: { vacancyId: true },
        });
        if (!vacancyIdRow) {
          throw new NotFoundException('Application not found');
        }

        const vacancy = await this.lockVacancy(
          tx,
          companyId,
          vacancyIdRow.vacancyId,
        );
        if (
          vacancy.status !== VacancyStatus.OPEN &&
          vacancy.status !== VacancyStatus.PAUSED
        ) {
          throw new BadRequestException(
            'Vacancy must be OPEN or PAUSED to hire',
          );
        }
        if (vacancy.filledCount >= vacancy.headcount) {
          throw new ConflictException('Vacancy has no remaining capacity');
        }

        const application = await this.lockApplication(
          tx,
          companyId,
          applicationId,
        );

        const existingHiring = await tx.hiring.findUnique({
          where: { applicationId },
          select: { id: true },
        });
        if (existingHiring) {
          throw new ConflictException('Application already hired');
        }

        if (application.stage !== ApplicationStage.OFFER) {
          throw new BadRequestException(
            'Application must be in OFFER stage to hire',
          );
        }
        if (application.status !== ApplicationStatus.ACTIVE) {
          throw new BadRequestException('Application is not active');
        }
        if (
          !isPreHireClear(application.securityStudyStatus) ||
          !isPreHireClear(application.medicalExamStatus)
        ) {
          throw new BadRequestException(
            'Estudio de seguridad y exámenes médicos deben estar aprobados o no requeridos antes de contratar',
          );
        }

        const offerRows = await tx.$queryRaw<
          Array<{
            id: string;
            status: JobOfferStatus;
            applicationId: string;
            contractApprovalStatus: ContractApprovalStatus;
            signedOfferLetterFileName: string | null;
          }>
        >`
          SELECT id, status, "applicationId", "contractApprovalStatus",
                 "signedOfferLetterFileName"
          FROM job_offers
          WHERE "applicationId" = ${applicationId}::uuid
            AND "companyId" = ${companyId}::uuid
          FOR UPDATE
        `;
        const offer = offerRows[0];
        if (!offer) {
          throw new BadRequestException('Application has no job offer');
        }
        if (offer.status !== JobOfferStatus.ACCEPTED) {
          throw new BadRequestException(
            'Job offer must be ACCEPTED before hiring',
          );
        }
        if (
          offer.contractApprovalStatus !== ContractApprovalStatus.APPROVED &&
          offer.contractApprovalStatus !== ContractApprovalStatus.NOT_REQUIRED
        ) {
          throw new BadRequestException(
            'El contrato debe estar aprobado (o no requerir aprobación) antes de contratar',
          );
        }

        const company = await tx.company.findFirst({
          where: { id: companyId },
          select: { offerLetterTemplateFileName: true },
        });
        if (
          company?.offerLetterTemplateFileName &&
          !offer.signedOfferLetterFileName
        ) {
          throw new BadRequestException(
            'Debes cargar la carta oferta firmada antes de contratar',
          );
        }

        const candidate = await tx.candidate.findFirst({
          where: {
            id: application.candidateId,
            companyId,
            deletedAt: null,
          },
        });
        if (!candidate) {
          throw new NotFoundException('Candidate not found');
        }

        const email = candidate.email.trim().toLowerCase();
        const existingEmployee = await tx.employee.findFirst({
          where: { companyId, email, deletedAt: null },
          select: { id: true },
        });
        if (existingEmployee) {
          throw new ConflictException(
            'An employee with this email already exists in the company',
          );
        }

        const position = await tx.position.findFirst({
          where: {
            id: vacancy.positionId,
            companyId,
            deletedAt: null,
          },
        });
        if (!position) {
          throw new BadRequestException('Vacancy position is invalid');
        }
        if (position.areaId !== vacancy.areaId) {
          throw new BadRequestException(
            'Vacancy area does not match position area',
          );
        }

        const employee = await tx.employee.create({
          data: {
            companyId,
            firstName: candidate.firstName.trim(),
            lastName: candidate.lastName.trim(),
            email,
            phone: dto.phone?.trim() || candidate.phone || null,
            country: candidate.country || null,
            state: candidate.state || null,
            city: candidate.city || null,
            areaId: vacancy.areaId,
            positionId: vacancy.positionId,
            businessUnitId: dto.businessUnitId ?? null,
            status: EmployeeStatus.ACTIVE,
            hireDate,
          },
        });

        const capacity = await tx.vacancy.updateMany({
          where: {
            id: vacancy.id,
            companyId,
            filledCount: vacancy.filledCount,
            deletedAt: null,
          },
          data: {
            filledCount: { increment: 1 },
          },
        });
        if (capacity.count !== 1) {
          throw new ConflictException(
            'Vacancy capacity changed concurrently; retry',
          );
        }

        // Re-check capacity after increment against headcount (DB CHECK also guards).
        const updatedVacancy = await tx.vacancy.findFirstOrThrow({
          where: { id: vacancy.id, companyId },
        });
        if (updatedVacancy.filledCount > updatedVacancy.headcount) {
          throw new ConflictException('Vacancy capacity exceeded');
        }

        await tx.candidate.update({
          where: { id: candidate.id },
          data: { status: CandidateStatus.HIRED },
        });

        const appTransition = await tx.application.updateMany({
          where: {
            id: applicationId,
            companyId,
            stage: ApplicationStage.OFFER,
            deletedAt: null,
          },
          data: {
            stage: ApplicationStage.HIRED,
            status: ApplicationStatus.CLOSED,
            lastStageChangedAt: new Date(),
          },
        });
        if (appTransition.count !== 1) {
          throw new ConflictException(
            'Application stage changed concurrently; retry',
          );
        }

        await tx.applicationStageHistory.create({
          data: {
            companyId,
            applicationId,
            fromStage: ApplicationStage.OFFER,
            toStage: ApplicationStage.HIRED,
            changedByUserId: userId,
            comment: 'Contratación formal',
          },
        });

        const hiring = await tx.hiring.create({
          data: {
            companyId,
            applicationId,
            jobOfferId: offer.id,
            employeeId: employee.id,
            candidateId: candidate.id,
            vacancyId: vacancy.id,
            hiredByUserId: userId,
            hireDate,
          },
          include: HIRING_INCLUDE,
        });

        const discarded = await this.discardOtherFinalists(tx, {
          companyId,
          vacancyId: vacancy.id,
          hiredApplicationId: applicationId,
          userId,
          vacancyTitle: updatedVacancy.title,
        });

        return {
          hiring,
          candidateId: candidate.id,
          vacancyId: vacancy.id,
          employeeId: employee.id,
          offerId: offer.id,
          discarded,
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          error.code === 'P2034'
            ? 'Hiring conflict: concurrent hire; retry'
            : 'Hiring conflict: duplicate employee or hiring record',
        );
      }
      if (
        error instanceof Prisma.PrismaClientUnknownRequestError &&
        /vacancies_filled_lte_headcount_check|deadlock detected/i.test(
          error.message,
        )
      ) {
        throw new ConflictException(
          'Vacancy capacity changed concurrently; retry',
        );
      }
      throw error;
    }

    await this.audit.create({
      action: ATS_AUDIT.HIRING_COMPLETED,
      entity: 'Hiring',
      entityId: result.hiring.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        hiringId: result.hiring.id,
        applicationId,
        candidateId: result.candidateId,
        vacancyId: result.vacancyId,
        employeeId: result.employeeId,
        jobOfferId: result.offerId,
        discardedFinalistCount: result.discarded.length,
      },
    });

    await this.audit.create({
      action: ATS_AUDIT.APPLICATION_STAGE_CHANGED,
      entity: 'Application',
      entityId: applicationId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        applicationId,
        candidateId: result.candidateId,
        vacancyId: result.vacancyId,
        fromStage: ApplicationStage.OFFER,
        toStage: ApplicationStage.HIRED,
        via: 'HIRING',
      },
    });

    for (const item of result.discarded) {
      await this.audit.create({
        action: ATS_AUDIT.FINALIST_DISCARDED_ON_HIRE,
        entity: 'Application',
        entityId: item.applicationId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          applicationId: item.applicationId,
          candidateId: item.candidateId,
          vacancyId: result.vacancyId,
          hiredApplicationId: applicationId,
          toStage: ApplicationStage.REJECTED,
          candidateStatus: CandidateStatus.IN_POOL,
        },
      });

      const delivery = await this.mail.sendText({
        to: item.email,
        subject: item.thankYou.subject,
        text: item.thankYou.body,
      });

      await this.audit.create({
        action: ATS_AUDIT.FINALIST_THANK_YOU_SENT,
        entity: 'Candidate',
        entityId: item.candidateId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          applicationId: item.applicationId,
          candidateId: item.candidateId,
          vacancyId: result.vacancyId,
          email: item.email,
          subject: item.thankYou.subject,
          body: item.thankYou.body,
          delivery: delivery.status,
          deliveryReason: delivery.reason ?? null,
          messageId: delivery.messageId ?? null,
          error: delivery.error ?? null,
        },
      });
    }

    const pdi = await this.hirePdi.syncOnHire({
      companyId,
      userId,
      applicationId,
      employeeId: result.employeeId,
    });

    return { ...result.hiring, pdi };
  }

  private async discardOtherFinalists(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      vacancyId: string;
      hiredApplicationId: string;
      userId: string;
      vacancyTitle: string;
    },
  ) {
    const company = await tx.company.findFirstOrThrow({
      where: { id: input.companyId },
      select: {
        name: true,
        atsThankYouLetterSubject: true,
        atsThankYouLetterBody: true,
      },
    });

    const siblings = await tx.application.findMany({
      where: {
        companyId: input.companyId,
        vacancyId: input.vacancyId,
        id: { not: input.hiredApplicationId },
        deletedAt: null,
        status: ApplicationStatus.ACTIVE,
        stage: ApplicationStage.OFFER,
      },
      select: {
        id: true,
        stage: true,
        candidateId: true,
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    const discarded: Array<{
      applicationId: string;
      candidateId: string;
      email: string;
      thankYou: { subject: string; body: string };
    }> = [];

    for (const sibling of siblings) {
      await tx.application.update({
        where: { id: sibling.id },
        data: {
          stage: ApplicationStage.REJECTED,
          status: ApplicationStatus.CLOSED,
          lastStageChangedAt: new Date(),
        },
      });
      await tx.applicationStageHistory.create({
        data: {
          companyId: input.companyId,
          applicationId: sibling.id,
          fromStage: sibling.stage,
          toStage: ApplicationStage.REJECTED,
          changedByUserId: input.userId,
          comment: 'Descartado automáticamente: otro finalista fue contratado',
        },
      });
      await tx.jobOffer.updateMany({
        where: {
          companyId: input.companyId,
          applicationId: sibling.id,
          status: {
            in: [
              JobOfferStatus.DRAFT,
              JobOfferStatus.SENT,
              JobOfferStatus.ACCEPTED,
            ],
          },
        },
        data: { status: JobOfferStatus.WITHDRAWN },
      });
      if (sibling.candidate.status !== CandidateStatus.HIRED) {
        await tx.candidate.update({
          where: { id: sibling.candidateId },
          data: { status: CandidateStatus.IN_POOL },
        });
      }
      discarded.push({
        applicationId: sibling.id,
        candidateId: sibling.candidateId,
        email: sibling.candidate.email,
        thankYou: renderThankYouLetter({
          subject: company.atsThankYouLetterSubject,
          body: company.atsThankYouLetterBody,
          firstName: sibling.candidate.firstName,
          lastName: sibling.candidate.lastName,
          vacancyTitle: input.vacancyTitle,
          companyName: company.name,
        }),
      });
    }

    return discarded;
  }

  private async requireApplication(companyId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, companyId, deletedAt: null },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  private async lockVacancy(
    tx: Prisma.TransactionClient,
    companyId: string,
    vacancyId: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        positionId: string;
        areaId: string;
        headcount: number;
        filledCount: number;
        status: VacancyStatus;
      }>
    >`
      SELECT id, "positionId", "areaId", headcount, "filledCount", status
      FROM vacancies
      WHERE id = ${vacancyId}::uuid
        AND "companyId" = ${companyId}::uuid
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const vacancy = rows[0];
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }
    return vacancy;
  }

  private async lockApplication(
    tx: Prisma.TransactionClient,
    companyId: string,
    applicationId: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        companyId: string;
        candidateId: string;
        vacancyId: string;
        stage: ApplicationStage;
        status: ApplicationStatus;
        securityStudyStatus: PreHireCheckStatus;
        medicalExamStatus: PreHireCheckStatus;
      }>
    >`
      SELECT id, "companyId", "candidateId", "vacancyId", stage, status,
             "securityStudyStatus", "medicalExamStatus"
      FROM applications
      WHERE id = ${applicationId}::uuid
        AND "companyId" = ${companyId}::uuid
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const application = rows[0];
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }
}
