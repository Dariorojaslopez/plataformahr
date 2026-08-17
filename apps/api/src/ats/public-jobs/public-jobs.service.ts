import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  CandidateStatus,
  CompanyStatus,
  Prisma,
  PlatformModule,
  VacancyStatus,
} from '@prisma/client';
import { BrandingService } from '../../core/companies/branding/branding.service';
import { PLATFORM_BRAND_PRIMARY } from '../../core/companies/branding/branding.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import type { PublicJobApplicationDto } from './dto/public-job.dto';

const PUBLIC_JOB_NOT_FOUND = 'Vacante no disponible';
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;

@Injectable()
export class PublicJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
  ) {}

  async get(publicId: string) {
    const vacancy = await this.findAvailable(publicId);
    return this.toResponse(vacancy);
  }

  async logo(publicId: string) {
    const vacancy = await this.findAvailable(publicId);
    return this.branding.readLogo(vacancy.companyId);
  }

  async apply(publicId: string, dto: PublicJobApplicationDto) {
    if (!PUBLIC_ID_PATTERN.test(publicId)) {
      throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM vacancies
          WHERE "publicId" = ${publicId}
            AND "publishedAt" IS NOT NULL
            AND status = 'OPEN'::"VacancyStatus"
            AND "deletedAt" IS NULL
          FOR SHARE
        `;
        const vacancyId = locked[0]?.id;
        if (!vacancyId) {
          throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
        }

        const vacancy = await tx.vacancy.findFirst({
          where: {
            id: vacancyId,
            company: {
              status: CompanyStatus.ACTIVE,
              deletedAt: null,
              OR: [
                { modules: { none: {} } },
                {
                  modules: {
                    some: { module: PlatformModule.ATS, enabled: true },
                  },
                },
              ],
            },
          },
          select: { id: true, companyId: true, publicId: true },
        });
        if (!vacancy) {
          throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
        }

        const email = dto.email.trim().toLowerCase();
        const documentNumber = dto.documentNumber.trim();
        const [byEmail, byDocument] = await Promise.all([
          tx.candidate.findUnique({
            where: {
              companyId_email: { companyId: vacancy.companyId, email },
            },
          }),
          tx.candidate.findUnique({
            where: {
              companyId_documentNumber: {
                companyId: vacancy.companyId,
                documentNumber,
              },
            },
          }),
        ]);

        if (
          (byDocument && byDocument.id !== byEmail?.id) ||
          (byEmail?.documentNumber && byEmail.documentNumber !== documentNumber)
        ) {
          throw new ConflictException(
            'No fue posible registrar la postulación con estos datos.',
          );
        }

        const candidate = byEmail
          ? await tx.candidate.update({
              where: { id: byEmail.id },
              data: {
                deletedAt: null,
                status: CandidateStatus.ACTIVE,
                phone: byEmail.phone ?? dto.phone.trim(),
                documentType: byEmail.documentType ?? dto.documentType,
                documentNumber: byEmail.documentNumber ?? documentNumber,
              },
            })
          : await tx.candidate.create({
              data: {
                companyId: vacancy.companyId,
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                email,
                phone: dto.phone.trim(),
                documentType: dto.documentType,
                documentNumber,
                source: 'PUBLIC_JOB',
                status: CandidateStatus.ACTIVE,
              },
            });

        const duplicate = await tx.application.findUnique({
          where: {
            candidateId_vacancyId: {
              candidateId: candidate.id,
              vacancyId: vacancy.id,
            },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ConflictException(
            'Ya existe una postulación para esta vacante.',
          );
        }

        const application = await tx.application.create({
          data: {
            companyId: vacancy.companyId,
            candidateId: candidate.id,
            vacancyId: vacancy.id,
            stage: ApplicationStage.PENDING_REVIEW,
            status: ApplicationStatus.ACTIVE,
            history: {
              create: {
                companyId: vacancy.companyId,
                toStage: ApplicationStage.PENDING_REVIEW,
              },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            action: ATS_AUDIT.PUBLIC_APPLICATION_CREATED,
            entity: 'Application',
            entityId: application.id,
            companyId: vacancy.companyId,
            metadata: {
              applicationId: application.id,
              vacancyId: vacancy.id,
              publicId: vacancy.publicId,
            },
          },
        });
      });
      return { ok: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.isDuplicateApplication(
          publicId,
          dto.email,
        );
        if (duplicate) {
          throw new ConflictException(
            'Ya existe una postulación para esta vacante.',
          );
        }
        throw new ConflictException(
          'No fue posible registrar la postulación con estos datos.',
        );
      }
      throw error;
    }
  }

  private async findAvailable(publicId: string) {
    if (!PUBLIC_ID_PATTERN.test(publicId)) {
      throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
    }
    const vacancy = await this.prisma.vacancy.findFirst({
      where: {
        publicId,
        publishedAt: { not: null },
        status: VacancyStatus.OPEN,
        deletedAt: null,
        company: {
          status: CompanyStatus.ACTIVE,
          deletedAt: null,
          OR: [
            { modules: { none: {} } },
            {
              modules: {
                some: { module: PlatformModule.ATS, enabled: true },
              },
            },
          ],
        },
      },
      select: {
        companyId: true,
        publicId: true,
        title: true,
        description: true,
        publishedAt: true,
        area: { select: { name: true } },
        company: {
          select: {
            name: true,
            brandPrimaryColor: true,
            logoFileName: true,
          },
        },
      },
    });
    if (!vacancy) {
      throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
    }
    return vacancy;
  }

  private toResponse(vacancy: Awaited<ReturnType<typeof this.findAvailable>>) {
    return {
      publicId: vacancy.publicId,
      title: vacancy.title,
      description: vacancy.description,
      areaName: vacancy.area.name,
      companyName: vacancy.company.name,
      brandPrimaryColor:
        vacancy.company.brandPrimaryColor ?? PLATFORM_BRAND_PRIMARY,
      hasLogo: Boolean(vacancy.company.logoFileName),
      publishedAt: vacancy.publishedAt,
    };
  }

  private async isDuplicateApplication(publicId: string, rawEmail: string) {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { publicId },
      select: { id: true, companyId: true },
    });
    if (!vacancy) return false;
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        companyId_email: {
          companyId: vacancy.companyId,
          email: rawEmail.trim().toLowerCase(),
        },
      },
      select: { id: true },
    });
    if (!candidate) return false;
    return Boolean(
      await this.prisma.application.findUnique({
        where: {
          candidateId_vacancyId: {
            candidateId: candidate.id,
            vacancyId: vacancy.id,
          },
        },
        select: { id: true },
      }),
    );
  }
}
