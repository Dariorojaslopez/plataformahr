import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VacancyRequestStatus, VacancyRequestType } from '@prisma/client';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../ats.constants';

export class CreateVacancyRequestDto {
  @IsEnum(VacancyRequestType)
  type!: VacancyRequestType;

  @IsOptional()
  @IsUUID()
  requestedByEmployeeId?: string;

  @ValidateIf(
    (o: CreateVacancyRequestDto) =>
      o.type === VacancyRequestType.EXISTING_POSITION,
  )
  @IsUUID()
  existingPositionId?: string;

  @ValidateIf(
    (o: CreateVacancyRequestDto) => o.type === VacancyRequestType.NEW_POSITION,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  requestedPositionName?: string;

  @ValidateIf(
    (o: CreateVacancyRequestDto) => o.type === VacancyRequestType.NEW_POSITION,
  )
  @IsUUID()
  requestedAreaId?: string;

  @IsOptional()
  @IsUUID()
  requestedJobLevelId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedHeadcount!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  justification!: string;

  @IsOptional()
  @IsBoolean()
  generalManagerApprovalRequired?: boolean;
}

export class UpdateVacancyRequestDto {
  @IsOptional()
  @IsEnum(VacancyRequestType)
  type?: VacancyRequestType;

  @IsOptional()
  @IsUUID()
  requestedByEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  existingPositionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestedPositionName?: string | null;

  @IsOptional()
  @IsUUID()
  requestedAreaId?: string | null;

  @IsOptional()
  @IsUUID()
  requestedJobLevelId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedHeadcount?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  justification?: string;

  @IsOptional()
  @IsBoolean()
  generalManagerApprovalRequired?: boolean;
}

export class ListVacancyRequestsQueryDto {
  @IsOptional()
  @IsEnum(VacancyRequestStatus)
  status?: VacancyRequestStatus;

  @IsOptional()
  @IsEnum(VacancyRequestType)
  type?: VacancyRequestType;

  @IsOptional()
  @IsUUID()
  requestedByEmployeeId?: string;

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

export class ApprovalDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectDecisionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  comment!: string;
}
