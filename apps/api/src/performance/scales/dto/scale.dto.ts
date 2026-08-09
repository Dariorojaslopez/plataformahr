import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizationEntityStatus } from '@prisma/client';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../performance.constants';

export class CreateCompetencyScaleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}

export class UpdateCompetencyScaleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}

export class CreateScaleLevelDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  value!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}

export class UpdateScaleLevelDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class ListScalesQueryDto {
  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;

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
