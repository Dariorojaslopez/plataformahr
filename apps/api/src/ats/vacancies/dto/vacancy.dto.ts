import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  IsInt,
  ValidateIf,
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

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedRecruiterEmployeeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'salaryAmount must be a non-negative decimal with up to 2 places',
  })
  salaryAmount?: string | null;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'salaryCurrency must be a 3-letter ISO code',
  })
  salaryCurrency?: string;

  @IsOptional()
  @IsBoolean()
  showSalaryPublic?: boolean;
}
