import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CalibrationNineBoxCellInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  row!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  col!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a hex value like #RRGGBB',
  })
  color!: string;
}

export class CreateCalibrationSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  opensAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  closesAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  inviteeEmployeeIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  leaderEmployeeIds?: string[];
}

export class UpdateCalibrationSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  opensAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  closesAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(9)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => CalibrationNineBoxCellInputDto)
  cells?: CalibrationNineBoxCellInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  inviteeEmployeeIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  leaderEmployeeIds?: string[];
}

export class SaveCalibrationPlacementDto {
  @IsUUID()
  employeeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  row!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  col!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  justification!: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;
}
