import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CompetencyScaleFormat,
  CompetencyScaleKind,
  OrganizationEntityStatus,
} from '@prisma/client';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../performance.constants';
import { MAX_DESCRIPTIVE_LEVELS } from '../scale-format';

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

  @IsOptional()
  @IsEnum(CompetencyScaleKind)
  kind?: CompetencyScaleKind;

  @IsOptional()
  @IsEnum(CompetencyScaleFormat)
  format?: CompetencyScaleFormat;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  likertIcon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  decimalPlaces?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DESCRIPTIVE_LEVELS)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  descriptiveLabels?: string[];
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

  @IsOptional()
  @IsEnum(CompetencyScaleKind)
  kind?: CompetencyScaleKind;

  @IsOptional()
  @IsEnum(CompetencyScaleFormat)
  format?: CompetencyScaleFormat;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(20)
  likertIcon?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(3)
  currencyCode?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  decimalPlaces?: number | null;
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
  @IsEnum(CompetencyScaleKind)
  kind?: CompetencyScaleKind;

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
