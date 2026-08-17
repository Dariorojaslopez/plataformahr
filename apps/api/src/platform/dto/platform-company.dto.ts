import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CompanyStatus } from '@prisma/client';
import {
  COMPANY_FEATURE_CODES,
  COMPANY_MODULE_CODES,
  type CompanyFeatureCode,
  type CompanyModuleCode,
} from '@talento/shared';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePlatformCompanyDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminFirstName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminLastName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  adminEmail!: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  initialPassword?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_MODULE_CODES, { each: true })
  enabledModules!: CompanyModuleCode[];

  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_FEATURE_CODES, { each: true })
  enabledFeatures!: CompanyFeatureCode[];
}

export class UpdatePlatformCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}

export class UpdatePlatformCompanyFeaturesDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_MODULE_CODES, { each: true })
  enabledModules!: CompanyModuleCode[];

  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_FEATURE_CODES, { each: true })
  enabledFeatures!: CompanyFeatureCode[];
}

export class ResetPlatformCompanyAdminPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;
}
