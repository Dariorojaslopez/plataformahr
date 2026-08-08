import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  InterviewStatus,
  JobOfferStatus,
  OfferEmploymentType,
  Prisma,
  SalaryPeriod,
  type JobOffer,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ATS_AUDIT } from '../ats.constants';
import type { CreateJobOfferDto, UpdateJobOfferDto } from './dto/offer.dto';
import { canTransitionOffer, isOfferExpired } from './offer-transitions';

const OFFER_INCLUDE = {
  application: {
    select: {
      id: true,
      stage: true,
      status: true,
      candidateId: true,
      vacancyId: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
      vacancy: {
        select: {
          id: true,
          title: true,
          status: true,
          filledCount: true,
          headcount: true,
          position: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async getByApplication(companyId: string, applicationId: string) {
    await this.requireApplication(companyId, applicationId);
    const offer = await this.prisma.jobOffer.findFirst({
      where: { companyId, applicationId },
      include: OFFER_INCLUDE,
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return this.maybeMarkExpired(offer);
  }

  async getById(companyId: string, id: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id, companyId },
      include: OFFER_INCLUDE,
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return this.maybeMarkExpired(offer);
  }

  async create(
    companyId: string,
    userId: string,
    applicationId: string,
    dto: CreateJobOfferDto,
  ) {
    const application = await this.requireApplication(companyId, applicationId);

    if (application.status !== ApplicationStatus.ACTIVE) {
      throw new BadRequestException('Application is not active');
    }
    if (application.stage !== ApplicationStage.INTERVIEW) {
      throw new BadRequestException(
        'Offer can only be created when Application is in INTERVIEW',
      );
    }

    const existing = await this.prisma.jobOffer.findUnique({
      where: { applicationId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Application already has a job offer');
    }

    const salaryAmount = this.parseSalary(dto.salaryAmount);
    const salaryCurrency = (dto.salaryCurrency ?? 'COP').toUpperCase();
    this.assertCurrency(salaryCurrency);
    this.assertExpirationFuture(dto.expiresAt);

    try {
      const created = await this.prisma.jobOffer.create({
        data: {
          companyId,
          applicationId,
          status: JobOfferStatus.DRAFT,
          positionTitle: dto.positionTitle.trim(),
          salaryAmount,
          salaryCurrency,
          salaryPeriod: dto.salaryPeriod ?? SalaryPeriod.MONTHLY,
          employmentType: dto.employmentType ?? OfferEmploymentType.FULL_TIME,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          notes: dto.notes?.trim() || null,
          createdByUserId: userId,
        },
        include: OFFER_INCLUDE,
      });

      await this.audit.create({
        action: ATS_AUDIT.OFFER_CREATED,
        entity: 'JobOffer',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          offerId: created.id,
          applicationId,
          toStatus: JobOfferStatus.DRAFT,
        },
      });

      return created;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Application already has a job offer');
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateJobOfferDto,
  ) {
    const offer = await this.requireOffer(companyId, id);
    if (offer.status !== JobOfferStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT offers can be edited');
    }

    if (dto.salaryAmount !== undefined) {
      this.parseSalary(dto.salaryAmount);
    }
    if (dto.salaryCurrency !== undefined) {
      this.assertCurrency(dto.salaryCurrency.toUpperCase());
    }
    if (dto.expiresAt !== undefined && dto.expiresAt !== null) {
      this.assertExpirationFuture(dto.expiresAt);
    }

    const data: Prisma.JobOfferUpdateInput = {};
    if (dto.positionTitle !== undefined) {
      data.positionTitle = dto.positionTitle.trim();
    }
    if (dto.salaryAmount !== undefined) {
      data.salaryAmount = this.parseSalary(dto.salaryAmount);
    }
    if (dto.salaryCurrency !== undefined) {
      data.salaryCurrency = dto.salaryCurrency.toUpperCase();
    }
    if (dto.salaryPeriod !== undefined) data.salaryPeriod = dto.salaryPeriod;
    if (dto.employmentType !== undefined) {
      data.employmentType = dto.employmentType;
    }
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }

    const updated = await this.prisma.jobOffer.update({
      where: { id },
      data,
      include: OFFER_INCLUDE,
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_UPDATED,
      entity: 'JobOffer',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        offerId: id,
        applicationId: offer.applicationId,
        status: JobOfferStatus.DRAFT,
      },
    });

    return updated;
  }

  async send(companyId: string, userId: string, id: string) {
    const offer = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOffer(tx, companyId, id);
      if (locked.status !== JobOfferStatus.DRAFT) {
        throw new ConflictException(
          'Offer status changed concurrently; only DRAFT can be sent',
        );
      }

      this.assertSendablePayload(locked);

      const completedCount = await tx.interview.count({
        where: {
          companyId,
          applicationId: locked.applicationId,
          status: InterviewStatus.COMPLETED,
          deletedAt: null,
        },
      });
      if (completedCount < 1) {
        throw new BadRequestException(
          'At least one COMPLETED interview is required before sending an offer',
        );
      }

      const application = await tx.application.findFirst({
        where: {
          id: locked.applicationId,
          companyId,
          deletedAt: null,
        },
      });
      if (!application || application.status !== ApplicationStatus.ACTIVE) {
        throw new BadRequestException('Application is not active');
      }
      if (
        application.stage !== ApplicationStage.INTERVIEW &&
        application.stage !== ApplicationStage.OFFER
      ) {
        throw new BadRequestException(
          `Cannot send offer while Application is in ${application.stage}`,
        );
      }

      const now = new Date();
      const transition = await tx.jobOffer.updateMany({
        where: {
          id,
          companyId,
          status: JobOfferStatus.DRAFT,
        },
        data: {
          status: JobOfferStatus.SENT,
          sentAt: now,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Offer status changed concurrently; retry');
      }

      return tx.jobOffer.findFirstOrThrow({
        where: { id, companyId },
        include: OFFER_INCLUDE,
      });
    });

    // Move Application INTERVIEW -> OFFER via existing pipeline (history + audit).
    if (offer.application.stage === ApplicationStage.INTERVIEW) {
      await this.applicationsService.move(
        companyId,
        userId,
        offer.applicationId,
        {
          stage: ApplicationStage.OFFER,
          comment: 'Oferta laboral enviada',
        },
      );
    }

    await this.audit.create({
      action: ATS_AUDIT.OFFER_SENT,
      entity: 'JobOffer',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        offerId: id,
        applicationId: offer.applicationId,
        fromStatus: JobOfferStatus.DRAFT,
        toStatus: JobOfferStatus.SENT,
      },
    });

    return this.getById(companyId, id);
  }

  async accept(companyId: string, userId: string, id: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOffer(tx, companyId, id);
      await this.ensureNotExpiredLocked(tx, locked);

      if (locked.status !== JobOfferStatus.SENT) {
        throw new ConflictException(
          'Offer is not SENT; cannot register acceptance',
        );
      }
      if (!canTransitionOffer(locked.status, JobOfferStatus.ACCEPTED)) {
        throw new BadRequestException('Invalid offer transition');
      }

      const now = new Date();
      const transition = await tx.jobOffer.updateMany({
        where: { id, companyId, status: JobOfferStatus.SENT },
        data: {
          status: JobOfferStatus.ACCEPTED,
          acceptedAt: now,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Offer status changed concurrently; retry');
      }

      return tx.jobOffer.findFirstOrThrow({
        where: { id, companyId },
        include: OFFER_INCLUDE,
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_ACCEPTED,
      entity: 'JobOffer',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        offerId: id,
        applicationId: updated.applicationId,
        fromStatus: JobOfferStatus.SENT,
        toStatus: JobOfferStatus.ACCEPTED,
        administrative: true,
      },
    });

    // Application stays OFFER. No HIRED / Candidate / filledCount / Employee.
    return updated;
  }

  async reject(companyId: string, userId: string, id: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOffer(tx, companyId, id);
      await this.ensureNotExpiredLocked(tx, locked);

      if (locked.status !== JobOfferStatus.SENT) {
        throw new ConflictException(
          'Offer is not SENT; cannot register rejection',
        );
      }

      const now = new Date();
      const transition = await tx.jobOffer.updateMany({
        where: { id, companyId, status: JobOfferStatus.SENT },
        data: {
          status: JobOfferStatus.REJECTED,
          rejectedAt: now,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Offer status changed concurrently; retry');
      }

      return tx.jobOffer.findFirstOrThrow({
        where: { id, companyId },
        include: OFFER_INCLUDE,
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_REJECTED,
      entity: 'JobOffer',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        offerId: id,
        applicationId: updated.applicationId,
        fromStatus: JobOfferStatus.SENT,
        toStatus: JobOfferStatus.REJECTED,
        administrative: true,
      },
    });

    // Application remains OFFER (ACTIVE). Closing is deferred.
    return updated;
  }

  async withdraw(companyId: string, userId: string, id: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOffer(tx, companyId, id);
      if (
        locked.status !== JobOfferStatus.DRAFT &&
        locked.status !== JobOfferStatus.SENT
      ) {
        throw new ConflictException(
          'Only DRAFT or SENT offers can be withdrawn',
        );
      }

      // Expired SENT can still be withdrawn after marking expired.
      if (isOfferExpired(locked)) {
        await this.markExpiredInTx(tx, locked);
        throw new BadRequestException(
          'Offer is expired; withdraw is not applicable',
        );
      }

      const fromStatus = locked.status;
      const now = new Date();
      const transition = await tx.jobOffer.updateMany({
        where: { id, companyId, status: fromStatus },
        data: {
          status: JobOfferStatus.WITHDRAWN,
          withdrawnAt: now,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Offer status changed concurrently; retry');
      }

      return {
        offer: await tx.jobOffer.findFirstOrThrow({
          where: { id, companyId },
          include: OFFER_INCLUDE,
        }),
        fromStatus,
      };
    });

    await this.audit.create({
      action: ATS_AUDIT.OFFER_WITHDRAWN,
      entity: 'JobOffer',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        offerId: id,
        applicationId: updated.offer.applicationId,
        fromStatus: updated.fromStatus,
        toStatus: JobOfferStatus.WITHDRAWN,
      },
    });

    return updated.offer;
  }

  private async maybeMarkExpired<T extends JobOffer>(offer: T): Promise<T> {
    if (!isOfferExpired(offer) || offer.status === JobOfferStatus.EXPIRED) {
      return offer;
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.markExpiredInTx(tx, offer);
      });
      return {
        ...offer,
        status: JobOfferStatus.EXPIRED,
        expiredAt: offer.expiredAt ?? new Date(),
      };
    } catch {
      return offer;
    }
  }

  private async ensureNotExpiredLocked(
    tx: Prisma.TransactionClient,
    offer: JobOffer,
  ): Promise<void> {
    if (!isOfferExpired(offer)) return;
    await this.markExpiredInTx(tx, offer);
    throw new BadRequestException('Offer is expired and cannot be accepted');
  }

  private async markExpiredInTx(
    tx: Prisma.TransactionClient,
    offer: Pick<JobOffer, 'id' | 'companyId' | 'status' | 'applicationId'>,
  ): Promise<void> {
    if (offer.status === JobOfferStatus.EXPIRED) return;
    if (offer.status !== JobOfferStatus.SENT) return;

    const now = new Date();
    const result = await tx.jobOffer.updateMany({
      where: {
        id: offer.id,
        companyId: offer.companyId,
        status: JobOfferStatus.SENT,
      },
      data: {
        status: JobOfferStatus.EXPIRED,
        expiredAt: now,
      },
    });
    if (result.count === 1) {
      // Audit outside would need user; mark lazily without audit user when read-path.
      // Explicit expire via accept/reject path audits via OFFER_EXPIRED below if needed.
    }
  }

  private async lockOffer(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ): Promise<JobOffer> {
    const rows = await tx.$queryRaw<JobOffer[]>`
      SELECT *
      FROM job_offers
      WHERE id = ${id}::uuid
        AND "companyId" = ${companyId}::uuid
      FOR UPDATE
    `;
    const offer = rows[0];
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
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

  private async requireOffer(companyId: string, id: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id, companyId },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  private parseSalary(value: string): Prisma.Decimal {
    const decimal = new Prisma.Decimal(value);
    if (decimal.isNeg()) {
      throw new BadRequestException('salaryAmount must be >= 0');
    }
    return decimal;
  }

  private assertCurrency(code: string): void {
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new BadRequestException(
        'salaryCurrency must be a 3-letter ISO code',
      );
    }
  }

  private assertExpirationFuture(expiresAt?: string | null): void {
    if (!expiresAt) return;
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('expiresAt is invalid');
    }
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future');
    }
  }

  private assertSendablePayload(offer: JobOffer): void {
    if (!offer.positionTitle?.trim()) {
      throw new BadRequestException('positionTitle is required to send');
    }
    if (offer.salaryAmount == null) {
      throw new BadRequestException('salaryAmount is required to send');
    }
    if (offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future to send');
    }
  }
}
