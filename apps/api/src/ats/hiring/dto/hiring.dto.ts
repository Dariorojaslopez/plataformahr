import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Minimal hiring decision payload.
 * Candidate/Vacancy/Position/Offer are derived from the Application path.
 */
export class CreateHiringDto {
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  /** Required only when Organization expects a BU and it cannot be derived. */
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
