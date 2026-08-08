import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStage, ApplicationStatus } from '@prisma/client';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../ats.constants';

export class CreateApplicationDto {
  @IsUUID()
  candidateId!: string;

  @IsUUID()
  vacancyId!: string;
}

export class CreateApplicationForCandidateDto {
  @IsUUID()
  vacancyId!: string;
}

export class MoveApplicationDto {
  @IsEnum(ApplicationStage)
  stage!: ApplicationStage;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ListApplicationsQueryDto {
  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT;
}
