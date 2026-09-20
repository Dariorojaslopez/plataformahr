import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OFFER_LETTER_EMAIL_BODY_MAX,
  OFFER_LETTER_EMAIL_SUBJECT_MAX,
} from '../ats-templates/offer-letter-email-html';

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

  @IsOptional()
  @IsString()
  @MaxLength(OFFER_LETTER_EMAIL_SUBJECT_MAX)
  atsOfferLetterEmailSubject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(OFFER_LETTER_EMAIL_BODY_MAX)
  atsOfferLetterEmailBody?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(OFFER_LETTER_EMAIL_SUBJECT_MAX)
  atsContractEmailSubject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(OFFER_LETTER_EMAIL_BODY_MAX)
  atsContractEmailBody?: string | null;
}
