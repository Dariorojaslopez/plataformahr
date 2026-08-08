import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OrganizationEntityStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePositionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsUUID()
  areaId!: string;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  responsibilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredExperience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredEducation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headcount?: number;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  responsibilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredExperience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredEducation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headcount?: number;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}
