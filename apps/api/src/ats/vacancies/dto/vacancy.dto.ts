import {
  IsEnum,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VacancyStatus } from '@prisma/client';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../ats.constants';

export class ListVacanciesQueryDto {
  @IsOptional()
  @IsEnum(VacancyStatus)
  status?: VacancyStatus;

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

export class UpdateVacancyDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(VacancyStatus)
  status?: VacancyStatus;
}
