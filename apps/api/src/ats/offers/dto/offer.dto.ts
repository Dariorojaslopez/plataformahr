import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OfferEmploymentType, SalaryPeriod } from '@prisma/client';

export class CreateJobOfferDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  positionTitle!: string;

  /** Decimal string, e.g. "4500000.00" — never a float from the client. */
  @IsNumberString({ no_symbols: false })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'salaryAmount must be a non-negative decimal with up to 2 places',
  })
  salaryAmount!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'salaryCurrency must be a 3-letter ISO code',
  })
  salaryCurrency?: string;

  @IsOptional()
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @IsOptional()
  @IsEnum(OfferEmploymentType)
  employmentType?: OfferEmploymentType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateJobOfferDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  positionTitle?: string;

  @IsOptional()
  @IsNumberString({ no_symbols: false })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'salaryAmount must be a non-negative decimal with up to 2 places',
  })
  salaryAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'salaryCurrency must be a 3-letter ISO code',
  })
  salaryCurrency?: string;

  @IsOptional()
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @IsOptional()
  @IsEnum(OfferEmploymentType)
  employmentType?: OfferEmploymentType;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
