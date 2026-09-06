import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
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
import {
  parseDateOnlyUtc,
} from '../vacancy-requests/vacancy-request-motive';
import type {
  ParseLinkedInDto,
  PublicEducationDto,
  PublicJobApplicationDto,
  PublicScreeningAnswerDto,
  PublicWorkExperienceDto,
} from './dto/public-job.dto';
import { extractCvText, inspectCvFile, type InspectedCv } from './cv-extract';
import { parseCandidateFromCvText } from './cv-parse';
import {
  hasLinkedInParsedData,
  LINKEDIN_ERRORS,
  normalizeLinkedInProfileUrl,
  parseLinkedInInput,
} from './linkedin';
import {
  buildCandidateFitText,
  buildJobFitText,
  computeProfileFit,
} from './profile-fit';
import { CV_ERRORS } from './cv.constants';
import {
  buildCvFileName,
  deleteCvFile,
  writeCvFile,
} from './cv.storage';

const PUBLIC_JOB_NOT_FOUND = 'Vacante no disponible';
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const SCREENING_FAIL =
  'No cumples el mínimo de respuestas correctas para esta vacante.';
const MAX_PROFILE_SEGMENTS = 10;

@Injectable()
export class PublicJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
  ) {}

  async preview(companyId: string, vacancyId: string) {
    const vacancy = await this.findVacancy({
      companyId,
      vacancyId,
      requirePublished: false,
    });
    return this.toResponse(vacancy);
  }

  async get(publicId: string) {
    const vacancy = await this.findAvailable(publicId);
    return this.toResponse(vacancy);
  }

  async logo(publicId: string) {
    const vacancy = await this.findAvailable(publicId);
    return this.branding.readLogo(vacancy.companyId);
  }

  async parseCv(publicId: string, file: Express.Multer.File | undefined) {
    await this.findAvailable(publicId);
    const inspected = this.requireInspectedCv(file);
    try {
      return parseCandidateFromCvText(extractCvText(inspected));
    } catch {
      throw new BadRequestException(CV_ERRORS.READ);
    }
  }

  async parseLinkedIn(publicId: string, dto: ParseLinkedInDto) {
    await this.findAvailable(publicId);
    const hasUrlInput = Boolean(dto.linkedinUrl?.trim());
    if (hasUrlInput && !normalizeLinkedInProfileUrl(dto.linkedinUrl)) {
      throw new BadRequestException(LINKEDIN_ERRORS.URL);
    }
    const parsed = parseLinkedInInput({
      linkedinUrl: dto.linkedinUrl,
      profileText: dto.profileText,
    });
    if (!hasLinkedInParsedData(parsed)) {
      throw new BadRequestException(LINKEDIN_ERRORS.EMPTY);
    }
    return parsed;
  }

  async apply(
    publicId: string,
    dto: PublicJobApplicationDto,
    file?: Express.Multer.File,
  ) {
    if (!PUBLIC_ID_PATTERN.test(publicId)) {
      throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
    }
    const inspected = file ? this.requireInspectedCv(file) : null;
    dto.workExperience = this.compactWorkExperience(dto.workExperience ?? []);
    dto.education = this.compactEducation(dto.education ?? []);
    this.assertProfileShape(dto);

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
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
          select: {
            id: true,
            companyId: true,
            publicId: true,
            title: true,
            description: true,
            screeningMinCorrect: true,
            screeningQuestions: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                prompt: true,
                correctAnswer: true,
                sortOrder: true,
              },
            },
            position: {
              select: {
                mission: true,
                responsibilities: true,
                requiredExperience: true,
                requiredEducation: true,
              },
            },
          },
        });
        if (!vacancy) {
          throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
        }

        const screening = this.evaluateScreening(
          vacancy.screeningQuestions,
          vacancy.screeningMinCorrect,
          dto.screeningAnswers ?? [],
        );

        const profileFit = computeProfileFit({
          requiredText: buildJobFitText([
            vacancy.position?.requiredExperience,
            vacancy.position?.requiredEducation,
          ]),
          jobText: buildJobFitText([
            vacancy.title,
            vacancy.description,
            vacancy.position?.mission,
            vacancy.position?.responsibilities,
          ]),
          candidateText: buildCandidateFitText([
            dto.professionalProfile,
            ...dto.workExperience.flatMap((item) => [
              item.companyName,
              item.positionTitle,
              item.functions,
              item.achievements,
            ]),
            ...dto.education.flatMap((item) => [
              item.institution,
              item.program,
              item.educationLevel,
            ]),
          ]),
          screeningPassed: screening.passed,
          screeningCorrectCount: screening.correctCount,
          screeningTotal: vacancy.screeningQuestions.length,
        });

        const email = dto.email.trim().toLowerCase();
        const documentNumber = dto.documentNumber.trim();
        const birthDate = parseDateOnlyUtc(dto.birthDate);
        if (!birthDate) {
          throw new BadRequestException('birthDate is invalid');
        }
        const linkedinUrl = this.resolveLinkedInUrl(dto.linkedinUrl);

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

        const profileData = {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone.trim(),
          documentType: dto.documentType,
          documentNumber,
          birthDate,
          country: dto.country.trim(),
          state: dto.state.trim(),
          city: dto.city.trim(),
          professionalProfile: dto.professionalProfile.trim(),
          linkedinUrl,
        };

        const candidate = byEmail
          ? await tx.candidate.update({
              where: { id: byEmail.id },
              data: {
                deletedAt: null,
                status: CandidateStatus.ACTIVE,
                ...profileData,
              },
            })
          : await tx.candidate.create({
              data: {
                companyId: vacancy.companyId,
                email,
                source: 'PUBLIC_JOB',
                status: CandidateStatus.ACTIVE,
                ...profileData,
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
            professionalProfile: dto.professionalProfile.trim(),
            screeningCorrectCount: screening.correctCount,
            screeningPassed: screening.passed,
            profileFitLevel: profileFit.level,
            profileFitSummary: profileFit.summary,
            history: {
              create: {
                companyId: vacancy.companyId,
                toStage: ApplicationStage.PENDING_REVIEW,
              },
            },
            workExperiences: {
              create: dto.workExperience.map((item, index) =>
                this.toWorkExperienceCreate(vacancy.companyId, item, index),
              ),
            },
            educations: {
              create: dto.education.map((item, index) =>
                this.toEducationCreate(vacancy.companyId, item, index),
              ),
            },
            screeningAnswers: {
              create: screening.answers.map((item) => ({
                companyId: vacancy.companyId,
                questionId: item.questionId,
                questionPrompt: item.questionPrompt,
                correctAnswer: item.correctAnswer,
                answer: item.answer,
                isCorrect: item.isCorrect,
                sortOrder: item.sortOrder,
              })),
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
              screeningPassed: screening.passed,
              screeningCorrectCount: screening.correctCount,
              profileFitLevel: profileFit.level,
            },
          },
        });
        return {
          candidateId: candidate.id,
          companyId: vacancy.companyId,
          previousCvFileName: byEmail?.cvFileName ?? null,
        };
      });
      if (inspected) {
        await this.persistCv(saved, inspected);
      }
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

  private assertProfileShape(dto: PublicJobApplicationDto) {
    if (!dto.workExperience?.length) {
      throw new BadRequestException('workExperience must include at least one item');
    }
    if (!dto.education?.length) {
      throw new BadRequestException('education must include at least one item');
    }
    if (dto.workExperience.length > MAX_PROFILE_SEGMENTS) {
      throw new BadRequestException(
        `workExperience allows at most ${MAX_PROFILE_SEGMENTS} items`,
      );
    }
    if (dto.education.length > MAX_PROFILE_SEGMENTS) {
      throw new BadRequestException(
        `education allows at most ${MAX_PROFILE_SEGMENTS} items`,
      );
    }
    for (const item of dto.workExperience) {
      if (item.isCurrent && item.endDate) {
        throw new BadRequestException(
          'endDate must be empty when work experience is current',
        );
      }
      if (!item.isCurrent && !item.endDate) {
        throw new BadRequestException(
          'endDate is required when work experience is not current',
        );
      }
    }
    for (const item of dto.education) {
      if (item.isStudying && item.endDate) {
        throw new BadRequestException(
          'endDate must be empty when currently studying',
        );
      }
      if (!item.isStudying && !item.endDate) {
        throw new BadRequestException(
          'endDate is required when not currently studying',
        );
      }
    }
  }

  private compactWorkExperience(items: PublicWorkExperienceDto[]) {
    const filled = items.filter(
      (item) =>
        Boolean(item.companyName?.trim()) ||
        Boolean(item.positionTitle?.trim()) ||
        Boolean(item.startDate?.trim()),
    );
    return filled.length > 0 ? filled.slice(0, MAX_PROFILE_SEGMENTS) : [];
  }

  private compactEducation(items: PublicEducationDto[]) {
    const filled = items.filter(
      (item) =>
        Boolean(item.institution?.trim()) ||
        Boolean(item.program?.trim()) ||
        Boolean(item.educationLevel) ||
        Boolean(item.startDate?.trim()),
    );
    return filled.length > 0 ? filled.slice(0, MAX_PROFILE_SEGMENTS) : [];
  }

  private evaluateScreening(
    questions: Array<{
      id: string;
      prompt: string;
      correctAnswer: boolean;
      sortOrder: number;
    }>,
    minCorrect: number | null,
    answers: PublicScreeningAnswerDto[],
  ) {
    if (questions.length === 0) {
      return {
        correctCount: 0,
        passed: true,
        answers: [] as Array<{
          questionId: string;
          questionPrompt: string;
          correctAnswer: boolean;
          answer: boolean;
          isCorrect: boolean;
          sortOrder: number;
        }>,
      };
    }

    const byId = new Map(answers.map((item) => [item.questionId, item.answer]));
    if (answers.length !== questions.length) {
      throw new BadRequestException(
        'Debes responder todas las preguntas de screening.',
      );
    }
    for (const question of questions) {
      if (!byId.has(question.id)) {
        throw new BadRequestException(
          'Debes responder todas las preguntas de screening.',
        );
      }
    }

    const scored = questions.map((question) => {
      const answer = byId.get(question.id)!;
      return {
        questionId: question.id,
        questionPrompt: question.prompt,
        correctAnswer: question.correctAnswer,
        answer,
        isCorrect: answer === question.correctAnswer,
        sortOrder: question.sortOrder,
      };
    });
    const correctCount = scored.filter((item) => item.isCorrect).length;
    const required = minCorrect ?? questions.length;
    const passed = correctCount >= required;
    if (!passed) {
      throw new BadRequestException(SCREENING_FAIL);
    }
    return { correctCount, passed, answers: scored };
  }

  private toWorkExperienceCreate(
    companyId: string,
    item: PublicWorkExperienceDto,
    index: number,
  ) {
    const startDate = parseDateOnlyUtc(item.startDate);
    if (!startDate) {
      throw new BadRequestException('workExperience startDate is invalid');
    }
    const endDate = item.isCurrent
      ? null
      : parseDateOnlyUtc(item.endDate ?? '');
    if (!item.isCurrent && !endDate) {
      throw new BadRequestException('workExperience endDate is invalid');
    }
    return {
      companyId,
      companyName: item.companyName.trim(),
      country: item.country?.trim() || null,
      positionTitle: item.positionTitle.trim(),
      startDate,
      endDate,
      isCurrent: item.isCurrent,
      functions: item.functions?.trim() || null,
      achievements: item.achievements?.trim() || null,
      sortOrder: index + 1,
    };
  }

  private toEducationCreate(
    companyId: string,
    item: PublicEducationDto,
    index: number,
  ) {
    const startDate = parseDateOnlyUtc(item.startDate);
    if (!startDate) {
      throw new BadRequestException('education startDate is invalid');
    }
    const endDate = item.isStudying
      ? null
      : parseDateOnlyUtc(item.endDate ?? '');
    if (!item.isStudying && !endDate) {
      throw new BadRequestException('education endDate is invalid');
    }
    return {
      companyId,
      institution: item.institution.trim(),
      program: item.program.trim(),
      educationLevel: item.educationLevel,
      startDate,
      endDate,
      isStudying: item.isStudying,
      sortOrder: index + 1,
    };
  }

  private resolveLinkedInUrl(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    const normalized = normalizeLinkedInProfileUrl(trimmed);
    if (!normalized) {
      throw new BadRequestException(LINKEDIN_ERRORS.URL);
    }
    return normalized;
  }

  private requireInspectedCv(
    file: Express.Multer.File | undefined,
  ): InspectedCv {
    if (!file) {
      throw new BadRequestException(CV_ERRORS.MISSING);
    }
    const inspected = inspectCvFile({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    if ('error' in inspected) {
      if (inspected.error === 'size') {
        throw new PayloadTooLargeException(CV_ERRORS.SIZE);
      }
      if (inspected.error === 'empty') {
        throw new BadRequestException(CV_ERRORS.EMPTY);
      }
      throw new UnsupportedMediaTypeException(CV_ERRORS.TYPE);
    }
    return inspected;
  }

  private async persistCv(
    saved: {
      candidateId: string;
      companyId: string;
      previousCvFileName: string | null;
    },
    inspected: InspectedCv,
  ) {
    const fileName = buildCvFileName(inspected.mime);
    await writeCvFile({
      uploadsDir: this.branding.uploadsDir(),
      companyId: saved.companyId,
      fileName,
      buffer: inspected.buffer,
    });
    await this.prisma.candidate.update({
      where: { id: saved.candidateId },
      data: {
        cvFileName: fileName,
        cvOriginalName: inspected.originalName,
        cvMimeType: inspected.mime,
      },
    });
    if (saved.previousCvFileName && saved.previousCvFileName !== fileName) {
      await deleteCvFile({
        uploadsDir: this.branding.uploadsDir(),
        companyId: saved.companyId,
        fileName: saved.previousCvFileName,
      });
    }
  }

  private async findAvailable(publicId: string) {
    return this.findVacancy({ publicId, requirePublished: true });
  }

  private async findVacancy(params: {
    publicId?: string;
    companyId?: string;
    vacancyId?: string;
    requirePublished: boolean;
  }) {
    if (params.publicId && !PUBLIC_ID_PATTERN.test(params.publicId)) {
      throw new NotFoundException(PUBLIC_JOB_NOT_FOUND);
    }
    const vacancy = await this.prisma.vacancy.findFirst({
      where: {
        ...(params.publicId ? { publicId: params.publicId } : {}),
        ...(params.vacancyId ? { id: params.vacancyId } : {}),
        ...(params.companyId ? { companyId: params.companyId } : {}),
        ...(params.requirePublished
          ? { publishedAt: { not: null }, status: VacancyStatus.OPEN }
          : {}),
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
        salaryAmount: true,
        salaryCurrency: true,
        showSalaryPublic: true,
        screeningMinCorrect: true,
        screeningQuestions: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            prompt: true,
            sortOrder: true,
          },
        },
        area: { select: { name: true } },
        position: {
          select: {
            name: true,
            mission: true,
            responsibilities: true,
            requiredExperience: true,
            requiredEducation: true,
          },
        },
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

  private toResponse(vacancy: Awaited<ReturnType<typeof this.findVacancy>>) {
    const salaryVisible =
      vacancy.showSalaryPublic && vacancy.salaryAmount != null;
    return {
      publicId: vacancy.publicId,
      title: vacancy.position?.name || vacancy.title,
      description: vacancy.description,
      positionName: vacancy.position?.name ?? vacancy.title,
      mission: vacancy.position?.mission ?? null,
      responsibilities: vacancy.position?.responsibilities ?? null,
      requiredExperience: vacancy.position?.requiredExperience ?? null,
      requiredEducation: vacancy.position?.requiredEducation ?? null,
      areaName: vacancy.area.name,
      companyName: vacancy.company.name,
      brandPrimaryColor:
        vacancy.company.brandPrimaryColor ?? PLATFORM_BRAND_PRIMARY,
      hasLogo: Boolean(vacancy.company.logoFileName),
      publishedAt: vacancy.publishedAt,
      salaryAmount:
        salaryVisible && vacancy.salaryAmount
          ? vacancy.salaryAmount.toFixed(2)
          : null,
      salaryCurrency: salaryVisible ? vacancy.salaryCurrency : null,
      screeningMinCorrect: vacancy.screeningMinCorrect,
      screeningQuestions: vacancy.screeningQuestions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        sortOrder: question.sortOrder,
      })),
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
