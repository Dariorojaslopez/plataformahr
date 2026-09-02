import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrganizationEntityStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { PositionCustomFieldValueInputDto } from '../../position-custom-fields/dto/position-custom-field.dto';
import { MAX_CUSTOM_FIELDS } from '../../position-custom-fields/position-custom-fields.validation';

export class CreatePositionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsUUID()
  areaId!: string;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string;

  @IsOptional()
  @IsUUID()
  parentPositionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  responsibilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredExperience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredEducation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headcount?: number;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CUSTOM_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => PositionCustomFieldValueInputDto)
  customFields?: PositionCustomFieldValueInputDto[];
}

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  parentPositionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  responsibilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredExperience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requiredEducation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headcount?: number;

  @IsOptional()
  @IsEnum(OrganizationEntityStatus)
  status?: OrganizationEntityStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CUSTOM_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => PositionCustomFieldValueInputDto)
  customFields?: PositionCustomFieldValueInputDto[];
}
