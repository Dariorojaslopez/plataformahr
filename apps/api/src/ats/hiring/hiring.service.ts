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
  EmployeeStatus,
  JobOfferStatus,
  Prisma,
  VacancyStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { OrganizationIntegrityService } from '../../organization/organization-integrity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import type { CreateHiringDto } from './dto/hiring.dto';

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

        const offerRows = await tx.$queryRaw<
          Array<{ id: string; status: JobOfferStatus; applicationId: string }>
        >`
          SELECT id, status, "applicationId"
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

        const vacancyRows = await tx.$queryRaw<
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
          WHERE id = ${application.vacancyId}::uuid
            AND "companyId" = ${companyId}::uuid
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        const vacancy = vacancyRows[0];
        if (!vacancy) {
          throw new NotFoundException('Vacancy not found');
        }
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

        return {
          hiring,
          candidateId: candidate.id,
          vacancyId: vacancy.id,
          employeeId: employee.id,
          offerId: offer.id,
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Hiring conflict: duplicate employee or hiring record',
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

    return result.hiring;
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
      }>
    >`
      SELECT id, "companyId", "candidateId", "vacancyId", stage, status
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
