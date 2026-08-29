import { Transform } from 'class-transformer';
import { IsBoolean, Matches } from 'class-validator';

export class UpdatePlatformCompanyPremiumDto {
  @IsBoolean()
  digitalSignature!: boolean;

  @IsBoolean()
  interviewRecording!: boolean;

  @IsBoolean()
  pdi!: boolean;
}

const MONEY = /^\d+(\.\d{1,2})?$/;
const MARGIN = /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdatePlatformCompanyBillingDto {
  @Transform(trim)
  @Matches(MONEY, {
    message: 'taxAmount must be a non-negative decimal with up to 2 places',
  })
  taxAmount!: string;

  @Transform(trim)
  @Matches(MONEY, {
    message: 'licenseAmount must be a non-negative decimal with up to 2 places',
  })
  licenseAmount!: string;

  @Transform(trim)
  @Matches(MONEY, {
    message:
      'subscriptionAmount must be a non-negative decimal with up to 2 places',
  })
  subscriptionAmount!: string;

  @Transform(trim)
  @Matches(MARGIN, {
    message: 'marginPercent must be between 0 and 100 with up to 2 places',
  })
  marginPercent!: string;
}
