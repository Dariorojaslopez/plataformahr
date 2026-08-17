import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VacancyStatus, type Vacancy } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../ats.constants';
import type {
  ListVacanciesQueryDto,
  UpdateVacancyDto,
} from './dto/vacancy.dto';

const ALLOWED_TRANSITIONS: Record<VacancyStatus, VacancyStatus[]> = {
  [VacancyStatus.OPEN]: [
    VacancyStatus.PAUSED,
    VacancyStatus.CLOSED,
    VacancyStatus.CANCELLED,
  ],
  [VacancyStatus.PAUSED]: [
    VacancyStatus.OPEN,
    VacancyStatus.CLOSED,
    VacancyStatus.CANCELLED,
  ],
  [VacancyStatus.CLOSED]: [],
  [VacancyStatus.CANCELLED]: [],
};

@Injectable()
export class VacanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListVacanciesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.VacancyWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            title: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vacancy.findMany({
        where,
        include: {
          position: { select: { id: true, name: true, headcount: true } },
          area: { select: { id: true, name: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vacancy.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string): Promise<Vacancy> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        position: true,
        area: true,
        vacancyRequest: {
          select: {
            id: true,
            type: true,
            status: true,
            requestedHeadcount: true,
          },
        },
      },
    });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }
    return vacancy;
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateVacancyDto,
  ): Promise<Vacancy> {
    const existing = await this.prisma.vacancy.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Vacancy not found');
    }

    if (dto.status && dto.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid vacancy status transition: ${existing.status} -> ${dto.status}`,
        );
      }
    }

    const updated = await this.prisma.vacancy.update({
      where: { id },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              closedAt:
                dto.status === VacancyStatus.CLOSED ||
                dto.status === VacancyStatus.CANCELLED
                  ? new Date()
                  : dto.status === VacancyStatus.OPEN ||
                      dto.status === VacancyStatus.PAUSED
                    ? null
                    : existing.closedAt,
            }
          : {}),
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.audit.create({
        action: ATS_AUDIT.VACANCY_STATUS_CHANGED,
        entity: 'Vacancy',
        entityId: updated.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          id: updated.id,
          from: existing.status,
          to: updated.status,
        },
      });
    }

    return updated;
  }

  async publish(
    companyId: string,
    userId: string,
    id: string,
  ): Promise<Vacancy> {
    const existing = await this.prisma.vacancy.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Vacancy not found');
    }
    if (existing.status !== VacancyStatus.OPEN) {
      throw new BadRequestException('Only OPEN vacancies can be published');
    }
    if (existing.publishedAt) {
      return existing;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const updated = await this.prisma.vacancy.update({
          where: { id },
          data: {
            publicId:
              existing.publicId ?? randomBytes(12).toString('base64url'),
            publishedAt: new Date(),
          },
        });
        await this.audit.create({
          action: ATS_AUDIT.VACANCY_PUBLISHED,
          entity: 'Vacancy',
          entityId: updated.id,
          company: { connect: { id: companyId } },
          user: { connect: { id: userId } },
          metadata: { vacancyId: updated.id, publicId: updated.publicId },
        });
        return updated;
      } catch (error: unknown) {
        const publicIdCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          !existing.publicId;
        if (!publicIdCollision) throw error;
      }
    }
    throw new ConflictException('Could not allocate a public vacancy URL');
  }

  async unpublish(
    companyId: string,
    userId: string,
    id: string,
  ): Promise<Vacancy> {
    const existing = await this.prisma.vacancy.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Vacancy not found');
    }
    if (!existing.publishedAt) {
      return existing;
    }

    const updated = await this.prisma.vacancy.update({
      where: { id },
      data: { publishedAt: null },
    });
    await this.audit.create({
      action: ATS_AUDIT.VACANCY_UNPUBLISHED,
      entity: 'Vacancy',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { vacancyId: updated.id, publicId: updated.publicId },
    });
    return updated;
  }
}
