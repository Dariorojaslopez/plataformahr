import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CANDIDATE_DOCUMENT_TYPE_CODES } from '@talento/shared';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PublicJobApplicationDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone!: string;

  @Transform(trim)
  @IsString()
  @IsIn(CANDIDATE_DOCUMENT_TYPE_CODES)
  documentType!: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N} .-]+$/u)
  documentNumber!: string;
}
