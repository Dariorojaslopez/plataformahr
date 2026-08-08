import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OrganizationEntityStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateJobLevelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rank!: number;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}

export class UpdateJobLevelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rank?: number;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}
