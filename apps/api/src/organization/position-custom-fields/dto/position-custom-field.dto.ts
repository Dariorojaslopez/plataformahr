import { PositionCustomFieldType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_SELECT_OPTIONS } from '../position-custom-fields.validation';

export class CreatePositionCustomFieldOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpsertPositionCustomFieldOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePositionCustomFieldDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsEnum(PositionCustomFieldType)
  type!: PositionCustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELECT_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => CreatePositionCustomFieldOptionDto)
  options?: CreatePositionCustomFieldOptionDto[];
}

export class UpdatePositionCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(PositionCustomFieldType)
  type?: PositionCustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SELECT_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => UpsertPositionCustomFieldOptionDto)
  options?: UpsertPositionCustomFieldOptionDto[];
}

export class PositionCustomFieldValueInputDto {
  @IsUUID()
  definitionId!: string;

  @Allow()
  value!: unknown;
}
