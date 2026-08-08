import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OrganizationEntityStatus } from '@prisma/client';

export class CreateAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @IsOptional()
  @IsUUID()
  parentAreaId?: string;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}

export class UpdateAreaDto {
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
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  businessUnitId?: string | null;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  parentAreaId?: string | null;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;
}
