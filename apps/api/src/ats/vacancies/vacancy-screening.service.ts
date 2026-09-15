import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateVacancyScreeningDto } from '../public-jobs/dto/public-job.dto';
import {
  isBooleanScreeningType,
  normalizeScreeningQuestionInput,
  parseScreeningOptions,
  parseStringIds,
  screeningJson,
  toPublicScreeningOptions,
} from '../public-jobs/screening-questions';

@Injectable()
export class VacancyScreeningService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenant: TenantContext, vacancyId: string) {
    await this.requireVacancy(tenant.companyId, vacancyId);
    const [vacancy, questions] = await Promise.all([
      this.prisma.vacancy.findFirstOrThrow({
        where: { id: vacancyId, companyId: tenant.companyId, deletedAt: null },
        select: { screeningMinCorrect: true },
      }),
      this.prisma.vacancyScreeningQuestion.findMany({
        where: { companyId: tenant.companyId, vacancyId },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return {
      minCorrect: vacancy.screeningMinCorrect,
      questions: questions.map((question) => {
        const options = parseScreeningOptions(question.options);
        return {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          correctAnswer: isBooleanScreeningType(question.type)
            ? (question.correctAnswer ?? false)
            : null,
          options: options.length > 0 ? toPublicScreeningOptions(options) : [],
          correctOptionIds: parseStringIds(question.correctOptionIds),
          sortOrder: question.sortOrder,
        };
      }),
    };
  }

  async replace(
    tenant: TenantContext,
    vacancyId: string,
    dto: UpdateVacancyScreeningDto,
  ) {
    await this.requireVacancy(tenant.companyId, vacancyId);
    const questions = (dto.questions ?? []).map((question) =>
      normalizeScreeningQuestionInput(question),
    );
    const minCorrect =
      dto.minCorrect === undefined
        ? questions.length > 0
          ? 1
          : null
        : dto.minCorrect;

    if (minCorrect != null && minCorrect > questions.length) {
      throw new BadRequestException(
        'screeningMinCorrect cannot exceed the number of questions',
      );
    }
    if (questions.length === 0 && minCorrect != null && minCorrect > 0) {
      throw new BadRequestException(
        'screeningMinCorrect requires at least one question',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vacancyScreeningQuestion.deleteMany({
        where: { companyId: tenant.companyId, vacancyId },
      });
      if (questions.length > 0) {
        await tx.vacancyScreeningQuestion.createMany({
          data: questions.map((question, index) => ({
            id: randomUUID(),
            companyId: tenant.companyId,
            vacancyId,
            prompt: question.prompt,
            type: question.type,
            correctAnswer: question.correctAnswer,
            options: screeningJson(question.options),
            correctOptionIds: screeningJson(question.correctOptionIds),
            sortOrder: index + 1,
            updatedAt: new Date(),
          })),
        });
      }
      await tx.vacancy.update({
        where: { id: vacancyId },
        data: {
          screeningMinCorrect:
            questions.length === 0 ? null : (minCorrect ?? null),
        },
      });
    });

    return this.get(tenant, vacancyId);
  }

  private async requireVacancy(companyId: string, vacancyId: string) {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }
    return vacancy;
  }
}
