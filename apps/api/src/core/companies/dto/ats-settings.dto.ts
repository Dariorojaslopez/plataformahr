import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCompanyAtsSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  vacancyHiringSlaDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  atsThankYouLetterSubject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  atsThankYouLetterBody?: string | null;
}
