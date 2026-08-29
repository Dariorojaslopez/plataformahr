import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidateStatus, Prisma, type Candidate } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import {
  emptyToNull,
  normalizeEmail,
} from '../../organization/organization.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATS_AUDIT,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../ats.constants';
import { CV_ERRORS } from '../public-jobs/cv.constants';
import { readCvFile, resolveCompanyUploadsDir } from '../public-jobs/cv.storage';
import type {
  CreateCandidateDto,
  ListCandidatesQueryDto,
  UpdateCandidateDto,
} from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListCandidatesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.CandidateWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              {
                email: { contains: search.toLowerCase(), mode: 'insensitive' },
              },
              {
                documentNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.candidate.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string): Promise<Candidate> {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    return candidate;
  }

  async readCv(companyId: string, id: string) {
    const candidate = await this.getById(companyId, id);
    if (!candidate.cvFileName || !candidate.cvMimeType) {
      throw new NotFoundException(CV_ERRORS.NOT_FOUND);
    }
    const buffer = await readCvFile({
      uploadsDir: resolveCompanyUploadsDir(),
      companyId,
      fileName: candidate.cvFileName,
    });
    return {
      buffer,
      mimeType: candidate.cvMimeType,
      originalName: candidate.cvOriginalName ?? 'cv',
    };
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateCandidateDto,
  ): Promise<Candidate> {
    const email = normalizeEmail(dto.email);
    const documentNumber = emptyToNull(dto.documentNumber) ?? null;

    try {
      const created = await this.prisma.candidate.create({
        data: {
          companyId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          phone: emptyToNull(dto.phone) ?? null,
          documentType: emptyToNull(dto.documentType) ?? null,
          documentNumber,
          country: emptyToNull(dto.country) ?? null,
          state: emptyToNull(dto.state) ?? null,
          city: emptyToNull(dto.city) ?? null,
          source: emptyToNull(dto.source) ?? null,
          status: CandidateStatus.ACTIVE,
        },
      });

      await this.audit.create({
        action: ATS_AUDIT.CANDIDATE_CREATED,
        entity: 'Candidate',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { candidateId: created.id },
      });

      return created;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A candidate with the same email or document already exists in this company',
        );
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateCandidateDto,
  ): Promise<Candidate> {
    await this.getById(companyId, id);

    if (dto.status === CandidateStatus.HIRED) {
      throw new BadRequestException(
        'Candidate status HIRED is reserved for the future hiring workflow',
      );
    }

    try {
      const updated = await this.prisma.candidate.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined
            ? { firstName: dto.firstName.trim() }
            : {}),
          ...(dto.lastName !== undefined
            ? { lastName: dto.lastName.trim() }
            : {}),
          ...(dto.email !== undefined
            ? { email: normalizeEmail(dto.email) }
            : {}),
          ...(dto.phone !== undefined ? { phone: emptyToNull(dto.phone) } : {}),
          ...(dto.documentType !== undefined
            ? { documentType: emptyToNull(dto.documentType) }
            : {}),
          ...(dto.documentNumber !== undefined
            ? { documentNumber: emptyToNull(dto.documentNumber) }
            : {}),
          ...(dto.country !== undefined
            ? { country: emptyToNull(dto.country) }
            : {}),
          ...(dto.state !== undefined ? { state: emptyToNull(dto.state) } : {}),
          ...(dto.city !== undefined ? { city: emptyToNull(dto.city) } : {}),
          ...(dto.source !== undefined
            ? { source: emptyToNull(dto.source) }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      await this.audit.create({
        action: ATS_AUDIT.CANDIDATE_UPDATED,
        entity: 'Candidate',
        entityId: updated.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { candidateId: updated.id },
      });

      return updated;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A candidate with the same email or document already exists in this company',
        );
      }
      throw error;
    }
  }
}
