import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { EducationLevel } from '@prisma/client';
import { CANDIDATE_DOCUMENT_TYPE_CODES } from '@talento/shared';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const parseJson = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

export class PublicWorkExperienceDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  country?: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  positionTitle!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @Transform(toBoolean)
  @IsBoolean()
  isCurrent!: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  functions?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  achievements?: string;
}

export class PublicEducationDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  institution!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  program!: string;

  @IsEnum(EducationLevel)
  educationLevel!: EducationLevel;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @Transform(toBoolean)
  @IsBoolean()
  isStudying!: boolean;
}

export class PublicScreeningAnswerDto {
  @IsUUID()
  questionId!: string;

  @Transform(toBoolean)
  @IsBoolean()
  answer!: boolean;
}

export class PublicJobApplicationDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone!: string;

  @Transform(trim)
  @IsString()
  @IsIn(CANDIDATE_DOCUMENT_TYPE_CODES)
  documentType!: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N} .-]+$/u)
  documentNumber!: string;

  @IsDateString()
  birthDate!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  country!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  state!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  professionalProfile!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  linkedinUrl?: string | null;

  @Transform(parseJson)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PublicWorkExperienceDto)
  workExperience!: PublicWorkExperienceDto[];

  @Transform(parseJson)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PublicEducationDto)
  education!: PublicEducationDto[];

  @IsOptional()
  @Transform(parseJson)
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PublicScreeningAnswerDto)
  screeningAnswers?: PublicScreeningAnswerDto[];
}

export class ParseLinkedInDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  linkedinUrl?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50_000)
  profileText?: string | null;
}

export class VacancyScreeningQuestionInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  prompt!: string;

  @IsBoolean()
  correctAnswer!: boolean;
}

export class UpdateVacancyScreeningDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  minCorrect?: number | null;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VacancyScreeningQuestionInputDto)
  questions!: VacancyScreeningQuestionInputDto[];
}
